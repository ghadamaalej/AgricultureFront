import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryRequest, DeliveryRequestService } from '../../services/delivery-request.service';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

type DeliveryPreview = {
  id: string;
  reference: string;
  product: string;
  weightKg: number;
  status: string;
  date: string;
};

@Component({
  selector: 'app-delivery-home',
  standalone: false,
  templateUrl: './delivery-home.component.html',
  styleUrls: ['./delivery-home.component.css']
})
export class DeliveryHomeComponent implements OnInit {
  roleLabel = this.readRoleLabel();
  isTransporter = this.isTransporterRole(this.roleLabel);
  private readonly currentUserId = this.requestService.getCurrentUserId();
  pendingRequests: DeliveryRequest[] = [];
  notification: string | null = null;
  private readonly acceptingRequestIds = new Set<string>();
  private readonly ignoredKeyPrefix = 'deliveryIgnoredRequests:';
  private ignoredRequestIds = new Set<string>();

  stats = [
    { value: '0', label: 'Total requests', icon: 'fas fa-inbox', accent: '#4caf50' },
    { value: '0', label: 'Long distance', icon: 'fas fa-road', accent: '#00acc1' },
    { value: '0', label: 'Grouped deliveries', icon: 'fas fa-layer-group', accent: '#ff8f00' }
  ];

  lastDeliveries: DeliveryPreview[] = [];

  constructor(private router: Router, private requestService: DeliveryRequestService) {
    if (this.isTransporter) {
      this.loadIgnoredRequests();
      this.reloadPendingRequests();
    }
  }

  ngOnInit(): void {
    this.requestService.refreshFromBackend().subscribe((all) => {
      if (this.isTransporter) {
        this.reloadPendingRequests();
        return;
      }

      this.hydrateFarmerHome(all);
    });
  }

  private hydrateFarmerHome(all: DeliveryRequest[]): void {
    const mine = all.filter((r) => r.createdById === this.currentUserId);
    const longDistance = mine.filter((r) => r.weightKg >= 250).length;
    const grouped = mine.filter((r) => Boolean(r.grouped)).length;

    this.stats = [
      { value: String(mine.length), label: 'Total requests', icon: 'fas fa-inbox', accent: '#4caf50' },
      { value: String(longDistance), label: 'Long distance', icon: 'fas fa-road', accent: '#00acc1' },
      { value: String(grouped), label: 'Grouped deliveries', icon: 'fas fa-layer-group', accent: '#ff8f00' }
    ];

    this.lastDeliveries = mine
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 3)
      .map((d) => ({
        id: d.id,
        reference: d.reference,
        product: d.product,
        weightKg: d.weightKg,
        status: d.status,
        date: this.toRelativeLabel(d.createdAt)
      }));
  }

  private toRelativeLabel(isoDate: string): string {
    const created = new Date(isoDate);
    if (Number.isNaN(created.getTime())) {
      return 'Unknown date';
    }

    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return 'Today';
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }

    return created.toLocaleDateString('fr-FR');
  }

  statusToClass(status: string): string {
    // Normalise to a CSS-friendly token: "En cours" => "en-cours"
    const normalized = status.trim().toLowerCase().replace(/\s+/g, '-');
    return `status-${normalized}`;
  }

  goCreate(): void {
    this.router.navigate(['/delivery/create']);
  }

  goTracking(): void {
    this.router.navigate(['/delivery/tracking']);
  }

  goDetail(requestId: string): void {
    this.router.navigate(['/delivery/livraisons', requestId]);
  }

  acceptRequest(request: DeliveryRequest): void {
    if (this.acceptingRequestIds.has(request.id)) {
      return;
    }

    this.acceptingRequestIds.add(request.id);
    this.requestService.acceptByCurrentTransporter(request.id).subscribe((result) => {
      this.acceptingRequestIds.delete(request.id);
      if (!result.success) {
        this.pushNotification(result.errorMessage || `Unable to take over ${request.reference}.`);
        return;
      }

      this.reloadPendingRequests();
      this.pushNotification(`Request ${request.reference} taken over (Accepted).`);
    });
  }

  isAccepting(requestId: string): boolean {
    return this.acceptingRequestIds.has(requestId);
  }

  negotiateRequest(request: DeliveryRequest): void {
    this.router.navigate(['/delivery/demandes'], {
      queryParams: { focus: request.id }
    });
  }

  ignoreRequest(request: DeliveryRequest): void {
    this.ignoredRequestIds.add(request.id);
    this.persistIgnoredRequests();
    this.reloadPendingRequests();
    this.pushNotification(`Request ${request.reference} ignored for your account.`);
  }

  private reloadPendingRequests(): void {
    this.pendingRequests = this.requestService
      .getPendingFarmerRequests()
      .filter((request) => !this.ignoredRequestIds.has(request.id));
  }

  private loadIgnoredRequests(): void {
    try {
      const raw = localStorage.getItem(this.ignoredStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      const values = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
      this.ignoredRequestIds = new Set(values);
    } catch {
      this.ignoredRequestIds = new Set<string>();
    }
  }

  private persistIgnoredRequests(): void {
    localStorage.setItem(this.ignoredStorageKey(), JSON.stringify(Array.from(this.ignoredRequestIds)));
  }

  private ignoredStorageKey(): string {
    return `${this.ignoredKeyPrefix}${this.requestService.getCurrentUserId()}`;
  }

  private pushNotification(message: string): void {
    this.notification = message;
    window.setTimeout(() => (this.notification = null), 3000);
  }

  private readRoleLabel(): string {
    return getDeliveryUserRole();
  }

  private isTransporterRole(role: string): boolean {
    const normalized = role.trim().toLowerCase();
    return (
      normalized === 'transporter' ||
      normalized === 'transporteur' ||
      normalized.includes('transport') ||
      normalized.includes('livreur')
    );
  }
}
