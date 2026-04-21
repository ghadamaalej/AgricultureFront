import { Component, OnInit } from '@angular/core';
import { DeliveryRequest, DeliveryRequestService } from '../../services/delivery-request.service';

type AdminDeliveryRow = {
  id: string;
  reference: string;
  status: string;
  product: string;
  weightKg: number;
  price: number;
  farmer: string;
  transporter: string;
  createdAt: string;
  deliveredAt: string;
};

type AdminStats = {
  total: number;
  pending: number;
  accepted: number;
  inProgress: number;
  delivered: number;
  refused: number;
  totalAmount: number;
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

  rows: AdminDeliveryRow[] = [];
  stats: AdminStats = {
    total: 0,
    pending: 0,
    accepted: 0,
    inProgress: 0,
    delivered: 0,
    refused: 0,
    totalAmount: 0,
    activeTransporters: 0
  };

  constructor(private requestService: DeliveryRequestService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.isLoading = true;
    this.loadError = null;

    this.requestService.refreshFromBackend().subscribe({
      next: (requests) => {
        this.rows = this.toRows(requests);
        this.stats = this.computeStats(requests);
        this.isLoading = false;
      },
      error: () => {
        this.rows = [];
        this.stats = {
          total: 0,
          pending: 0,
          accepted: 0,
          inProgress: 0,
          delivered: 0,
          refused: 0,
          totalAmount: 0,
          activeTransporters: 0
        };
        this.loadError = 'Impossible de charger les données administrateur.';
        this.isLoading = false;
      }
    });
  }

  get historyRows(): AdminDeliveryRow[] {
    return this.rows.slice(0, 12);
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
        farmer: request.createdByEmail || 'Agriculteur',
        transporter: request.acceptedByEmail || 'Non assigné',
        createdAt: this.toDateTime(request.createdAt),
        deliveredAt: request.deliveredAt ? this.toDateTime(request.deliveredAt) : '—'
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  private computeStats(requests: DeliveryRequest[]): AdminStats {
    const activeTransporters = new Set(
      requests
        .filter((request) => Boolean(request.acceptedByEmail))
        .map((request) => request.acceptedByEmail as string)
    ).size;

    return {
      total: requests.length,
      pending: requests.filter((request) => request.status === 'En attente').length,
      accepted: requests.filter((request) => request.status === 'Acceptée').length,
      inProgress: requests.filter((request) => request.status === 'En cours').length,
      delivered: requests.filter((request) => request.status === 'Livrée').length,
      refused: requests.filter((request) => request.status === 'Refusée').length,
      totalAmount: requests.reduce((sum, request) => sum + Number(request.estimatedPrice || 0), 0),
      activeTransporters
    };
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
