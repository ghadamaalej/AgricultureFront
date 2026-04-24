import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { Chart, ChartConfiguration } from 'chart.js';
import 'chart.js/auto';
import { Batch, InventoryProduct, StockMovement } from '../../models/inventory.models';
import { InventoryApiService } from '../../services/inventory-api.service';



interface KpiStats {
  totalProducts: number;
  totalUnits: number;
  lowStockCount: number;
  purchaseCost: number;
  salesRevenue: number;
  stockValue: number;
  netMargin: number;
}

@Component({
  selector: 'app-statistics-dashboard',
  standalone: false,
  templateUrl: './statistics-dashboard.component.html',
  styleUrls: ['./statistics-dashboard.component.css']
})
export class StatisticsDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stockPieChart') stockPieChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('lowStockBarChart') lowStockBarChartRef?: ElementRef<HTMLCanvasElement>;

  loading = true;
  error = '';

  products: InventoryProduct[] = [];
  movements: StockMovement[] = [];
  batchesByProduct = new Map<number, Batch[]>();

  kpis: KpiStats = {
    totalProducts: 0,
    totalUnits: 0,
    lowStockCount: 0,
    purchaseCost: 0,
    salesRevenue: 0,
    stockValue: 0,
    netMargin: 0
  };

  lowStockProducts: Array<{ name: string; current: number; threshold: number; deficit: number }> = [];

  private pieChart?: Chart;
  private barChart?: Chart;
  private viewReady = false;

  constructor(
    private api: InventoryApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryRenderCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  get hasData(): boolean {
    return !this.loading && this.products.length > 0 && !this.error;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      maximumFractionDigits: 2
    }).format(value || 0);
  }

  private loadStats(): void {
    this.loading = true;
    this.error = '';

    this.api.getMyProducts().pipe(
      switchMap((products) => {
        this.products = products;

        const movements$ = this.api.getMyMovements().pipe(
          catchError(() => of([] as StockMovement[]))
        );

        const batchesRequests = products.map((p) =>
          this.api.getProductBatches(p.id).pipe(catchError(() => of([] as Batch[])))
        );
        const batches$ = batchesRequests.length ? forkJoin(batchesRequests) : of([] as Batch[][]);

        return forkJoin({ movements: movements$, batchesByProduct: batches$ });
      })
    ).subscribe({
      next: ({ movements, batchesByProduct }) => {
        this.movements = movements;
        this.batchesByProduct.clear();

        this.products.forEach((p, index) => {
          this.batchesByProduct.set(p.id, batchesByProduct[index] || []);
        });

        this.computeStats();
        this.loading = false;
        // Ensure canvases behind *ngIf are present before creating Chart.js instances.
        this.cdr.detectChanges();
        this.tryRenderCharts();
        setTimeout(() => this.tryRenderCharts(), 0);
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 0) {
          this.error = 'Impossible de joindre le serveur statistiques (port 8088).';
        } else {
          this.error = err?.error?.message || 'Erreur lors du chargement des statistiques.';
        }
      }
    });
  }

  private computeStats(): void {
    const totalProducts = this.products.length;
    const totalUnits = this.products.reduce((sum, p) => sum + Number(p.currentQuantity || 0), 0);

    this.lowStockProducts = this.products
      .filter((p) => Number(p.currentQuantity || 0) <= Number(p.minThreshold || 0))
      .map((p) => {
        const current = Number(p.currentQuantity || 0);
        const threshold = Number(p.minThreshold || 0);
        return {
          name: p.nom,
          current,
          threshold,
          deficit: Math.max(threshold - current, 0)
        };
      })
      .sort((a, b) => b.deficit - a.deficit);

    let purchaseCost = 0;
    let stockValue = 0;
    const unitCostByProduct = new Map<number, number>();

    this.products.forEach((product) => {
      const batches = this.batchesByProduct.get(product.id) || [];
      const totalBatchQty = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      const totalBatchCost = batches.reduce((sum, b) => sum + Number(b.quantity || 0) * Number(b.price || 0), 0);

      purchaseCost += totalBatchCost;

      const averageUnitCost = totalBatchQty > 0 ? totalBatchCost / totalBatchQty : 0;
      unitCostByProduct.set(product.id, averageUnitCost);
      stockValue += Number(product.currentQuantity || 0) * averageUnitCost;
    });

    const salesRevenue = this.movements
      .filter((m) => m.reason === 'VENTE')
      .reduce((sum, m) => {
        const quantity = Number(m.quantity || 0);
        const notePrice = this.extractUnitPriceFromNote(m.note);
        const fallbackCost = unitCostByProduct.get(m.productId) || 0;
        const unitPrice = notePrice ?? fallbackCost;
        return sum + quantity * unitPrice;
      }, 0);

    this.kpis = {
      totalProducts,
      totalUnits,
      lowStockCount: this.lowStockProducts.length,
      purchaseCost,
      salesRevenue,
      stockValue,
      netMargin: salesRevenue - purchaseCost
    };
  }

  private extractUnitPriceFromNote(note?: string): number | null {
    if (!note) return null;
    const regexes = [
      /(?:prix|price|pu|unit(?:aire)?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:dt|tnd|eur|€)/i
    ];
    for (const regex of regexes) {
      const match = note.match(regex);
      if (match?.[1]) {
        const numeric = Number(match[1].replace(',', '.'));
        if (!Number.isNaN(numeric)) return numeric;
      }
    }
    return null;
  }

  private tryRenderCharts(): void {
    if (!this.viewReady || this.loading || this.error || !this.products.length) return;
    if (!this.stockPieChartRef || !this.lowStockBarChartRef) return;
    this.renderCharts();
  }

  private renderCharts(): void {
    this.destroyCharts();
    this.renderStockPie();
    this.renderLowStockBar();
  }

  private renderStockPie(): void {
    const categories: Record<string, number> = {};
    this.products.forEach((p) => {
      categories[p.categorie] = (categories[p.categorie] || 0) + Number(p.currentQuantity || 0);
    });

    const labels = Object.keys(categories).map((c) => this.categoryLabel(c));
    const values = Object.values(categories);

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 14, padding: 16 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } }
        }
      }
    };

    this.pieChart = new Chart(this.stockPieChartRef!.nativeElement, config);
  }

  private renderLowStockBar(): void {
    const topLowStock = this.lowStockProducts.slice(0, 8);
    const labels = topLowStock.map((p) => p.name);
    const values = topLowStock.map((p) => p.deficit);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Déficit',
          data: values,
          backgroundColor: '#E76F51',
          borderRadius: 8,
          maxBarThickness: 38
        }]
      },
      options: {
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    };

    this.barChart = new Chart(this.lowStockBarChartRef!.nativeElement, config);
  }


  private destroyCharts(): void {
    this.pieChart?.destroy();
    this.barChart?.destroy();
  }

  private categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      VACCIN: 'Vaccins',
      MEDICAMENT: 'Médicaments',
      ALIMENT: 'Aliments',
      RECOLTE: 'Récoltes',
      AUTRE: 'Autres'
    };
    return labels[category] || category;
  }

  private toMonthKey(date: string): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private monthLabel(key: string): string {
    const [year, month] = key.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }

  private lastMonths(count: number): string[] {
    const now = new Date();
    const list: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      list.push(`${year}-${month}`);
    }
    return list;
  }
}
