import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DeliveryAdminKpis,
  DeliveryRequest,
  DeliveryRequestService
} from '../../services/delivery-request.service';

type AdminDeliveryRow = {
  id: string;
  reference: string;
  status: string;
  product: string;
  weightKg: number;
  price: number;
  farmer: string;
  transporter: string;
  createdAtRaw: string;
  createdAtTs: number;
  createdAt: string;
  deliveredAtRaw: string;
  deliveredAt: string;
};

type AdminStatusFilter = 'ALL' | 'En attente' | 'Acceptée' | 'En cours' | 'Livrée' | 'Refusée';
type AdminPeriodFilter = 'ALL' | '7D' | '30D' | '90D';

type StatusBreakdownItem = {
  label: string;
  count: number;
  percent: number;
  className: string;
};

type MonthlyTrendItem = {
  label: string;
  created: number;
  delivered: number;
  revenue: number;
};

type TopTransporter = {
  name: string;
  handled: number;
  delivered: number;
  revenue: number;
};

type TopProduct = {
  name: string;
  deliveries: number;
  totalWeight: number;
  totalAmount: number;
};

type AdminStats = {
  total: number;
  pending: number;
  accepted: number;
  inProgress: number;
  delivered: number;
  refused: number;
  totalAmount: number;
  revenue: number;
  avgPrice: number;
  deliveryRate: number;
  cancellationRate: number;
  inProgressRate: number;
  activeTransporters: number;
};

@Component({
  selector: 'app-delivery-admin-overview',
  templateUrl: './delivery-admin-overview.component.html',
  styleUrls: ['./delivery-admin-overview.component.css']
})
export class DeliveryAdminOverviewComponent implements OnInit {
  isLoading = false;
  loadError: string | null = null;
  searchTerm = '';
  statusFilter: AdminStatusFilter = 'ALL';
  periodFilter: AdminPeriodFilter = 'ALL';

  rows: AdminDeliveryRow[] = [];
  statusBreakdown: StatusBreakdownItem[] = [];
  monthlyTrend: MonthlyTrendItem[] = [];
  topTransporters: TopTransporter[] = [];
  topProducts: TopProduct[] = [];
  stats: AdminStats = {
    total: 0,
    pending: 0,
    accepted: 0,
    inProgress: 0,
    delivered: 0,
    refused: 0,
    totalAmount: 0,
    revenue: 0,
    avgPrice: 0,
    deliveryRate: 0,
    cancellationRate: 0,
    inProgressRate: 0,
    activeTransporters: 0
  };

  constructor(private requestService: DeliveryRequestService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.isLoading = true;
    this.loadError = null;

    forkJoin({
      requests: this.requestService.refreshFromBackend(),
      kpis: this.requestService.getAdminKpis()
    }).subscribe({
      next: ({ requests, kpis }) => {
        this.rows = this.toRows(requests);
        this.stats = this.computeStats(requests, kpis);
        this.statusBreakdown = this.buildStatusBreakdown(this.stats);
        this.monthlyTrend = this.buildMonthlyTrend(this.rows);
        this.topTransporters = this.buildTopTransporters(this.rows);
        this.topProducts = this.buildTopProducts(this.rows);
        this.isLoading = false;
      },
      error: () => {
        this.rows = [];
        this.statusBreakdown = [];
        this.monthlyTrend = [];
        this.topTransporters = [];
        this.topProducts = [];
        this.stats = {
          total: 0,
          pending: 0,
          accepted: 0,
          inProgress: 0,
          delivered: 0,
          refused: 0,
          totalAmount: 0,
          revenue: 0,
          avgPrice: 0,
          deliveryRate: 0,
          cancellationRate: 0,
          inProgressRate: 0,
          activeTransporters: 0
        };
        this.loadError = 'Unable to load administrator data.';
        this.isLoading = false;
      }
    });
  }

  get displayedRows(): AdminDeliveryRow[] {
    const periodMs: Record<Exclude<AdminPeriodFilter, 'ALL'>, number> = {
      '7D': 7 * 24 * 60 * 60 * 1000,
      '30D': 30 * 24 * 60 * 60 * 1000,
      '90D': 90 * 24 * 60 * 60 * 1000
    };

    const normalizedQuery = this.searchTerm.trim().toLowerCase();
    const now = Date.now();

    return this.rows.filter((row) => {
      if (this.statusFilter !== 'ALL' && row.status !== this.statusFilter) {
        return false;
      }

      if (this.periodFilter !== 'ALL') {
        const threshold = now - periodMs[this.periodFilter];
        if (row.createdAtTs <= 0 || row.createdAtTs < threshold) {
          return false;
        }
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${row.reference} ${row.product} ${row.farmer} ${row.transporter}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }

  get historyRows(): AdminDeliveryRow[] {
    return this.displayedRows.slice(0, 12);
  }

  private toRows(requests: DeliveryRequest[]): AdminDeliveryRow[] {
    return requests
      .map((request) => ({
        id: request.id,
        reference: request.reference,
        status: request.status,
        product: request.product,
        weightKg: request.weightKg,
        price: Number(request.estimatedPrice || 0),
        farmer: request.createdByEmail || 'Farmer',
        transporter: request.acceptedByEmail || 'Not assigned',
        createdAtRaw: request.createdAt,
        createdAtTs: this.toTimestamp(request.createdAt),
        createdAt: this.toDateTime(request.createdAt),
        deliveredAtRaw: request.deliveredAt || '',
        deliveredAt: request.deliveredAt ? this.toDateTime(request.deliveredAt) : '—'
      }))
      .sort((a, b) => b.createdAtTs - a.createdAtTs);
  }

  private computeStats(requests: DeliveryRequest[], kpis: DeliveryAdminKpis): AdminStats {
    const total = kpis.total > 0 ? kpis.total : requests.length;
    const pending = kpis.enAttente > 0 ? kpis.enAttente : requests.filter((request) => request.status === 'En attente').length;
    const accepted = kpis.acceptees > 0 ? kpis.acceptees : requests.filter((request) => request.status === 'Acceptée').length;
    const inProgress = kpis.enCours > 0 ? kpis.enCours : requests.filter((request) => request.status === 'En cours').length;
    const delivered = kpis.livre > 0 ? kpis.livre : requests.filter((request) => request.status === 'Livrée').length;
    const refused = kpis.annulees > 0 ? kpis.annulees : requests.filter((request) => request.status === 'Refusée').length;
    const totalAmount = requests.reduce((sum, request) => sum + Number(request.estimatedPrice || 0), 0);
    const revenue = kpis.revenue > 0
      ? kpis.revenue
      : requests
          .filter((request) => request.status === 'Livrée')
          .reduce((sum, request) => sum + Number(request.estimatedPrice || 0), 0);

    const activeTransporters = new Set(
      requests
        .filter((request) => Boolean(request.acceptedByEmail))
        .map((request) => request.acceptedByEmail as string)
    ).size;

    const deliveryRate = kpis.tauxLivraison > 0
      ? kpis.tauxLivraison
      : (total > 0 ? (delivered * 100) / total : 0);

    return {
      total,
      pending,
      accepted,
      inProgress,
      delivered,
      refused,
      totalAmount: this.round2(totalAmount),
      revenue: this.round2(revenue),
      avgPrice: this.round2(kpis.avgPrice > 0 ? kpis.avgPrice : (total > 0 ? totalAmount / total : 0)),
      deliveryRate: this.round2(deliveryRate),
      cancellationRate: this.round2(total > 0 ? (refused * 100) / total : 0),
      inProgressRate: this.round2(total > 0 ? (inProgress * 100) / total : 0),
      activeTransporters
    };
  }

  private buildStatusBreakdown(stats: AdminStats): StatusBreakdownItem[] {
    return [
      { label: 'Pending', count: stats.pending, percent: stats.total > 0 ? (stats.pending * 100) / stats.total : 0, className: 'pending' },
      { label: 'Accepted', count: stats.accepted, percent: stats.total > 0 ? (stats.accepted * 100) / stats.total : 0, className: 'accepted' },
      { label: 'In progress', count: stats.inProgress, percent: stats.total > 0 ? (stats.inProgress * 100) / stats.total : 0, className: 'progress' },
      { label: 'Delivered', count: stats.delivered, percent: stats.total > 0 ? (stats.delivered * 100) / stats.total : 0, className: 'delivered' },
      { label: 'Refused', count: stats.refused, percent: stats.total > 0 ? (stats.refused * 100) / stats.total : 0, className: 'refused' }
    ].map((item) => ({ ...item, percent: this.round2(item.percent) }));
  }

  private buildMonthlyTrend(rows: AdminDeliveryRow[]): MonthlyTrendItem[] {
    const months = 6;
    const now = new Date();
    const trend: MonthlyTrendItem[] = [];

    for (let i = months - 1; i >= 0; i -= 1) {
      const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = bucketDate.getMonth();
      const year = bucketDate.getFullYear();

      const monthRows = rows.filter((row) => {
        const date = new Date(row.createdAtRaw);
        return date.getMonth() === month && date.getFullYear() === year;
      });

      trend.push({
        label: bucketDate.toLocaleDateString('en-US', { month: 'short' }),
        created: monthRows.length,
        delivered: monthRows.filter((row) => row.status === 'Livrée').length,
        revenue: this.round2(
          monthRows
            .filter((row) => row.status === 'Livrée')
            .reduce((sum, row) => sum + row.price, 0)
        )
      });
    }

    return trend;
  }

  private buildTopTransporters(rows: AdminDeliveryRow[]): TopTransporter[] {
    const grouped = new Map<string, TopTransporter>();

    rows.forEach((row) => {
      if (!row.transporter || row.transporter === 'Not assigned') {
        return;
      }

      const current = grouped.get(row.transporter) || {
        name: row.transporter,
        handled: 0,
        delivered: 0,
        revenue: 0
      };

      current.handled += 1;
      if (row.status === 'Livrée') {
        current.delivered += 1;
        current.revenue += row.price;
      }
      grouped.set(row.transporter, current);
    });

    return Array.from(grouped.values())
      .map((entry) => ({ ...entry, revenue: this.round2(entry.revenue) }))
      .sort((a, b) => {
        if (b.delivered !== a.delivered) {
          return b.delivered - a.delivered;
        }
        return b.handled - a.handled;
      })
      .slice(0, 5);
  }

  private buildTopProducts(rows: AdminDeliveryRow[]): TopProduct[] {
    const grouped = new Map<string, TopProduct>();

    rows.forEach((row) => {
      const name = row.product || 'Produit';
      const current = grouped.get(name) || {
        name,
        deliveries: 0,
        totalWeight: 0,
        totalAmount: 0
      };

      current.deliveries += 1;
      current.totalWeight += row.weightKg;
      current.totalAmount += row.price;
      grouped.set(name, current);
    });

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        totalWeight: this.round2(entry.totalWeight),
        totalAmount: this.round2(entry.totalAmount)
      }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 5);
  }

  private toTimestamp(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
