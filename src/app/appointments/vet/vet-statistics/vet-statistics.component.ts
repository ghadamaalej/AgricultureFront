import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../services/auth/auth.service';
import { InventoryApiService } from '../../../inventory/services/inventory-api.service';
import { InventoryProduct, StockMovement } from '../../../inventory/models/inventory.models';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AppointmentResponse, AppointmentStats } from '../../models/appointments.models';
import { CommandeVet } from '../vet-commandes/vet-commandes.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Chart from 'chart.js/auto';

export interface StatsPeriod {
  label: string;
  value: 'week' | 'month' | 'year';
}

@Component({
  selector: 'app-vet-statistics',
  standalone: false,
  templateUrl: './vet-statistics.component.html',
  styleUrls: ['./vet-statistics.component.css']
})
export class VetStatisticsComponent implements OnInit, OnDestroy, AfterViewInit {

  loading = true;
  error = '';

  // Period selector
  selectedPeriod: 'week' | 'month' | 'year' = 'month';
  periods: StatsPeriod[] = [
    { label: '7 jours', value: 'week' },
    { label: '30 jours', value: 'month' },
    { label: '12 mois', value: 'year' },
  ];

  // Data
  products: InventoryProduct[] = [];
  movements: StockMovement[] = [];
  appointments: AppointmentResponse[] = [];
  commandes: CommandeVet[] = [];
  appointmentStats: AppointmentStats | null = null;

  // KPI cards
  totalRevenue = 0;
  totalCost = 0;
  netGain = 0;
  totalOrders = 0;
  outOfStockCount = 0;
  lowStockCount = 0;

  // Charts
  private charts: Chart[] = [];
  private viewReady = false;
  private dataReady = false;

  private readonly baseInventory = 'http://localhost:8088/inventaires/api';
  private readonly baseCommandes = 'http://localhost:8088/inventaires/api/commandes';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private inventoryApi: InventoryApiService,
    private appointmentsApi: AppointmentsApiService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.dataReady) {
      setTimeout(() => this.buildAllCharts(), 100);
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    const vetId = this.auth.getCurrentUserId();
    if (!vetId) { this.error = 'Session expirée.'; this.loading = false; return; }

    forkJoin({
      products: this.inventoryApi.getMyProducts().pipe(catchError(() => of([]))),
      movements: this.inventoryApi.getMyMovements().pipe(catchError(() => of([]))),
      appointments: this.appointmentsApi.getVetAppointments(vetId).pipe(catchError(() => of([]))),
      appointmentStats: this.appointmentsApi.getVetStats(vetId).pipe(catchError(() => of(null))),
      commandes: this.http.get<CommandeVet[]>(`${this.baseCommandes}/vet/${vetId}`, { headers: this.headers() }).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ products, movements, appointments, appointmentStats, commandes }) => {
        this.products = products as InventoryProduct[];
        this.movements = movements as StockMovement[];
        this.appointments = appointments as AppointmentResponse[];
        this.appointmentStats = appointmentStats as AppointmentStats | null;
        this.commandes = commandes as CommandeVet[];
        this.computeKpis();
        this.loading = false;
        this.dataReady = true;
        if (this.viewReady) {
          setTimeout(() => this.buildAllCharts(), 100);
        }
      },
      error: () => {
        this.error = 'Erreur de chargement des données.';
        this.loading = false;
      }
    });
  }

  private computeKpis(): void {
    // Revenue from paid orders
    this.totalRevenue = this.commandes
      .filter(c => c.statut === 'PAYE')
      .reduce((s, c) => s + c.montantTotal, 0);

    // Cost from purchase movements
    this.totalCost = this.movements
      .filter(m => m.reason === 'ACHAT')
      .reduce((s, m) => {
        const prod = this.products.find(p => p.id === m.productId);
        return s + (prod?.prixAchat ?? 0) * m.quantity;
      }, 0);

    this.netGain = this.totalRevenue - this.totalCost;
    this.totalOrders = this.commandes.filter(c => c.statut === 'PAYE').length;
    this.outOfStockCount = this.products.filter(p => p.currentQuantity <= 0).length;
    this.lowStockCount = this.products.filter(p => p.currentQuantity > 0 && p.currentQuantity <= p.minThreshold).length;
  }

  setPeriod(p: 'week' | 'month' | 'year'): void {
    this.selectedPeriod = p;
    this.destroyCharts();
    setTimeout(() => this.buildAllCharts(), 50);
  }

  private destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  private buildAllCharts(): void {
    this.buildRevenueLineChart();
    this.buildGainBarChart();
    this.buildAppointmentStatusPieChart();
    this.buildCategoryBarChart();
    this.buildStockStatusPieChart();
    this.buildTopProductsChart();
  }

  // ─── REVENUE LINE CHART ───────────────────────────────────────────────────
  private buildRevenueLineChart(): void {
    const canvas = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (!canvas) return;
    const { labels, revenues, costs } = this.getTimeSeriesData();

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ventes (TND)',
            data: revenues,
            borderColor: '#2d6a2d',
            backgroundColor: 'rgba(45,106,45,0.12)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#2d6a2d',
            fill: true,
            tension: 0.4,
          },
          {
            label: 'Coûts (TND)',
            data: costs,
            borderColor: '#e07b39',
            backgroundColor: 'rgba(224,123,57,0.1)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#e07b39',
            fill: true,
            tension: 0.4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 12 }, usePointStyle: true } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => v + ' TND' } }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── GAIN BAR CHART ───────────────────────────────────────────────────────
  private buildGainBarChart(): void {
    const canvas = document.getElementById('gainChart') as HTMLCanvasElement;
    if (!canvas) return;
    const { labels, revenues, costs } = this.getTimeSeriesData();
    const gains = revenues.map((r, i) => r - costs[i]);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Gain net (TND)',
          data: gains,
          backgroundColor: gains.map(g => g >= 0 ? 'rgba(45,106,45,0.75)' : 'rgba(192,57,43,0.75)'),
          borderColor: gains.map(g => g >= 0 ? '#2d6a2d' : '#c0392b'),
          borderWidth: 1.5,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${(ctx.parsed.y ?? 0).toFixed(2)} TND` } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => v + ' TND' } }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── APPOINTMENT STATUS PIE ───────────────────────────────────────────────
  private buildAppointmentStatusPieChart(): void {
    const canvas = document.getElementById('rdvStatusChart') as HTMLCanvasElement;
    if (!canvas) return;

    const stats = this.appointmentStats;
    const data = stats ? [
      stats.pendingAppointments,
      stats.acceptedAppointments,
      stats.refusedAppointments || 0,
      stats.cancelledAppointments || 0,
    ] : [0, 0, 0, 0];

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['En attente', 'Acceptés', 'Refusés', 'Annulés'],
        datasets: [{
          data,
          backgroundColor: ['#f0a500', '#2d6a2d', '#c0392b', '#95a5a6'],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15, usePointStyle: true, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── CATEGORY DISTRIBUTION BAR ────────────────────────────────────────────
  private buildCategoryBarChart(): void {
    const canvas = document.getElementById('categoryChart') as HTMLCanvasElement;
    if (!canvas) return;

    const categoryMap: Record<string, number> = {};
    this.products.forEach(p => {
      const cat = this.categoryLabel(p.categorie);
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: Object.keys(categoryMap),
        datasets: [{
          label: 'Produits par catégorie',
          data: Object.values(categoryMap),
          backgroundColor: ['rgba(45,106,45,0.75)', 'rgba(52,152,219,0.75)', 'rgba(155,89,182,0.75)', 'rgba(230,126,34,0.75)', 'rgba(149,165,166,0.75)'],
          borderRadius: 8,
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } },
          y: { grid: { display: false } }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── STOCK STATUS PIE ─────────────────────────────────────────────────────
  private buildStockStatusPieChart(): void {
    const canvas = document.getElementById('stockStatusChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ok = this.products.filter(p => p.currentQuantity > p.minThreshold).length;
    const low = this.products.filter(p => p.currentQuantity > 0 && p.currentQuantity <= p.minThreshold).length;
    const out = this.products.filter(p => p.currentQuantity <= 0).length;

    const chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: ['Stock OK', 'Stock faible', 'Rupture'],
        datasets: [{
          data: [ok, low, out],
          backgroundColor: ['rgba(45,106,45,0.82)', 'rgba(240,165,0,0.82)', 'rgba(192,57,43,0.82)'],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15, usePointStyle: true, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${ctx.parsed} produits (${pct}%)`;
              }
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── MOVEMENTS LINE CHART ────────────────────────────────────────────────
  private buildMovementsLineChart(): void {
    const canvas = document.getElementById('movementsChart') as HTMLCanvasElement;
    if (!canvas) return;
    const { labels, dates } = this.getTimeSeriesDataWithDates();
    const entries = dates.map(d => this.countMovementsByDate(d, 'ENTREE'));
    const exits   = dates.map(d => this.countMovementsByDate(d, 'SORTIE'));

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Entrées stock',
            data: entries,
            borderColor: '#27ae60',
            backgroundColor: 'rgba(39,174,96,0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
          },
          {
            label: 'Sorties stock',
            data: exits,
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231,76,60,0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, font: { size: 12 } } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── COMMANDE STATUS DOUGHNUT ────────────────────────────────────────────
  private buildCommandeStatusChart(): void {
    const canvas = document.getElementById('commandeStatusChart') as HTMLCanvasElement;
    if (!canvas) return;

    const paid      = this.commandes.filter(c => c.statut === 'PAYE').length;
    const pending   = this.commandes.filter(c => c.statut === 'EN_ATTENTE').length;
    const failed    = this.commandes.filter(c => c.statut === 'ECHEC').length;
    const refunded  = this.commandes.filter(c => c.statut === 'REMBOURSE').length;

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Payées', 'En attente', 'Échouées', 'Remboursées'],
        datasets: [{
          data: [paid, pending, failed, refunded],
          backgroundColor: ['rgba(45,106,45,0.82)', 'rgba(240,165,0,0.82)', 'rgba(192,57,43,0.82)', 'rgba(52,152,219,0.82)'],
          borderColor: '#fff',
          borderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, font: { size: 11 } } }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── TOP PRODUCTS BAR ─────────────────────────────────────────────────────
  private buildTopProductsChart(): void {
    const canvas = document.getElementById('topProductsChart') as HTMLCanvasElement;
    if (!canvas) return;

    const soldMap: Record<string, number> = {};
    this.commandes.filter(c => c.statut === 'PAYE').forEach(c => {
      c.items.forEach(item => {
        soldMap[item.nomProduit] = (soldMap[item.nomProduit] || 0) + item.quantite;
      });
    });

    const sorted = Object.entries(soldMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sorted.map(([name]) => name.length > 18 ? name.substring(0, 18) + '…' : name);
    const values = sorted.map(([, qty]) => qty);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Quantité vendue',
          data: values,
          backgroundColor: 'rgba(45,106,45,0.75)',
          borderColor: '#2d6a2d',
          borderWidth: 1.5,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } }
        }
      }
    });
    this.charts.push(chart);
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  private getTimeSeriesData(): { labels: string[]; revenues: number[]; costs: number[] } {
    const now = new Date();
    const labels: string[] = [];
    const revenues: number[] = [];
    const costs: number[] = [];

    if (this.selectedPeriod === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
        labels.push(key);
        revenues.push(this.revenueForDay(d));
        costs.push(this.costForDay(d));
      }
    } else if (this.selectedPeriod === 'month') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        if (i % 3 === 0) {
          const key = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          labels.push(key);
          revenues.push(this.revenueForDay(d));
          costs.push(this.costForDay(d));
        }
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now); d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        labels.push(key);
        revenues.push(this.revenueForMonth(d));
        costs.push(this.costForMonth(d));
      }
    }
    return { labels, revenues, costs };
  }

  private revenueForDay(d: Date): number {
    return this.commandes
      .filter(c => c.statut === 'PAYE' && this.sameDay(new Date(c.dateCommande), d))
      .reduce((s, c) => s + c.montantTotal, 0);
  }

  private costForDay(d: Date): number {
    return this.movements
      .filter(m => m.reason === 'ACHAT' && this.sameDay(new Date(m.dateMouvement), d))
      .reduce((s, m) => {
        const prod = this.products.find(p => p.id === m.productId);
        return s + (prod?.prixAchat ?? 0) * m.quantity;
      }, 0);
  }

  private revenueForMonth(d: Date): number {
    return this.commandes
      .filter(c => c.statut === 'PAYE' && this.sameMonth(new Date(c.dateCommande), d))
      .reduce((s, c) => s + c.montantTotal, 0);
  }

  private costForMonth(d: Date): number {
    return this.movements
      .filter(m => m.reason === 'ACHAT' && this.sameMonth(new Date(m.dateMouvement), d))
      .reduce((s, m) => {
        const prod = this.products.find(p => p.id === m.productId);
        return s + (prod?.prixAchat ?? 0) * m.quantity;
      }, 0);
  }

  private getTimeSeriesDataWithDates(): { labels: string[]; dates: Date[] } {
    const now = new Date();
    const labels: string[] = [];
    const dates: Date[] = [];
    if (this.selectedPeriod === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }));
        dates.push(d);
      }
    } else if (this.selectedPeriod === 'month') {
      for (let i = 29; i >= 0; i--) {
        if (i % 3 === 0) {
          const d = new Date(now); d.setDate(d.getDate() - i);
          labels.push(d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
          dates.push(d);
        }
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now); d.setMonth(d.getMonth() - i);
        labels.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
        dates.push(d);
      }
    }
    return { labels, dates };
  }

  private countMovementsByDate(d: Date, type: 'ENTREE' | 'SORTIE'): number {
    if (this.selectedPeriod === 'year') {
      return this.movements.filter(m => m.movementType === type && this.sameMonth(new Date(m.dateMouvement), d)).length;
    }
    return this.movements.filter(m => m.movementType === type && this.sameDay(new Date(m.dateMouvement), d)).length;
  }

  private sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private sameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  private categoryLabel(cat: string): string {
    const map: Record<string, string> = {
      VACCIN: 'Vaccins', MEDICAMENT: 'Médicaments',
      ALIMENT: 'Aliments', RECOLTE: 'Récoltes', AUTRE: 'Autre'
    };
    return map[cat] || cat;
  }

  get lowStockProducts(): InventoryProduct[] {
    return this.products.filter(p => p.currentQuantity > 0 && p.currentQuantity <= p.minThreshold).slice(0, 5);
  }

  get outOfStockProducts(): InventoryProduct[] {
    return this.products.filter(p => p.currentQuantity <= 0).slice(0, 5);
  }

  formatAmount(n: number): string {
    return n.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TND';
  }
}
