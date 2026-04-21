import { Component, OnInit } from '@angular/core';
import { DeliveryRequest, DeliveryRequestService } from '../../services/delivery-request.service';
import { DeliveryExtendedService } from '../../services/delivery-extended.service';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

type StatusProgress = { status: string; percent: number; color: string };

@Component({
  selector: 'app-delivery-dashboard',
  standalone: false,
  templateUrl: './delivery-dashboard.component.html',
  styleUrls: ['./delivery-dashboard.component.css']
})
export class DeliveryDashboardComponent implements OnInit {
  private role = getDeliveryUserRole();
  private currentUserId = this.requestService.getCurrentUserId();

  summary = [] as Array<{ value: string; label: string; icon: string; color: string }>;

  statusProgress: StatusProgress[] = [];
  isLoading = false;
  loadError: string | null = null;

  backendMetrics: Array<{ label: string; value: string }> = [];

  constructor(
    private requestService: DeliveryRequestService,
    private deliveryExtendedService: DeliveryExtendedService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.loadError = null;

    this.requestService.refreshFromBackend().subscribe({
      next: (all) => {
        this.recompute(all);
        this.isLoading = false;
      },
      error: () => {
        this.summary = this.buildSummary([]);
        this.statusProgress = this.buildStatusProgress([]);
        this.isLoading = false;
        this.loadError = 'Unable to load statistics from the backend.';
      }
    });

    this.loadBackendMetrics();
  }

  private loadBackendMetrics(): void {
    if (this.isFarmer()) {
      this.deliveryExtendedService.getAgriculteurPlanningStats(this.currentUserId).subscribe((stats) => {
        if (!stats) {
          this.backendMetrics = [];
          return;
        }

        this.backendMetrics = [
          { label: 'Planning rate', value: `${(stats.planningRate ?? 0).toFixed(1)}%` },
          { label: 'Transporter assignment', value: `${(stats.transportAssignmentRate ?? 0).toFixed(1)}%` },
          { label: 'Delivery success rate', value: `${(stats.deliverySuccessRate ?? 0).toFixed(1)}%` },
          { label: 'Planned deliveries (30 days)', value: String(stats.next30DaysPlanned ?? 0) }
        ];
      });
      return;
    }

    this.deliveryExtendedService.getTransporterStats(this.currentUserId).subscribe((stats) => {
      if (!stats) {
        this.backendMetrics = [];
        return;
      }

      this.backendMetrics = [
        { label: 'Grouping rate', value: `${this.toPercent(stats.grouped, stats.total)}%` },
        { label: 'Average distance', value: `${(stats.avgDistancePerDelivery ?? 0).toFixed(1)} km` },
        { label: 'Delivered revenue', value: `${(stats.revenueDelivered ?? 0).toFixed(2)} TND` },
        { label: 'Success rate', value: `${(stats.deliverySuccessRate ?? 0).toFixed(1)}%` }
      ];
    });
  }

  private recompute(all: DeliveryRequest[]): void {
    const scoped = this.isFarmer()
      ? all.filter((r) => r.createdById === this.currentUserId)
      : all;

    this.summary = this.buildSummary(scoped);
    this.statusProgress = this.buildStatusProgress(scoped);
  }

  private isFarmer(): boolean {
    return this.role === 'agriculteur' || this.role === 'farmer' || this.role.includes('agric');
  }

  private buildSummary(requests: DeliveryRequest[]): Array<{ value: string; label: string; icon: string; color: string }> {
    const total = requests.length;
    const amount = requests.reduce((sum, r) => sum + r.estimatedPrice, 0);
    const inProgress = requests.filter((r) => r.status === 'En cours').length;
    const delivered = requests.filter((r) => r.status === 'Livrée').length;

    return [
      { value: String(total), label: 'Total requests', icon: 'fas fa-inbox', color: '#4caf50' },
      { value: `${amount.toLocaleString('fr-FR')} TND`, label: 'Cumulative amount', icon: 'fas fa-coins', color: '#ff8f00' },
      { value: String(inProgress), label: 'Requests in progress', icon: 'fas fa-route', color: '#00acc1' },
      { value: String(delivered), label: 'Delivered requests', icon: 'fas fa-check-circle', color: '#7b1fa2' }
    ];
  }

  private buildStatusProgress(requests: DeliveryRequest[]): StatusProgress[] {
    const total = requests.length || 1;
    const byStatus = (status: string) => requests.filter((r) => r.status === status).length;

    return [
      { status: 'En attente', percent: Math.round((byStatus('En attente') * 100) / total), color: '#ff8f00' },
      { status: 'Acceptée', percent: Math.round((byStatus('Acceptée') * 100) / total), color: '#00acc1' },
      { status: 'En cours', percent: Math.round((byStatus('En cours') * 100) / total), color: '#4caf50' },
      { status: 'Livrée', percent: Math.round((byStatus('Livrée') * 100) / total), color: '#7b1fa2' }
    ];
  }

  private toPercent(value: number, total: number): string {
    if (!total) {
      return '0.0';
    }
    return ((value * 100) / total).toFixed(1);
  }
}

