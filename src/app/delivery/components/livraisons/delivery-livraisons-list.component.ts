import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryRequest, DeliveryRequestService } from '../../services/delivery-request.service';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

type DeliveryType = 'Locale' | 'Longue distance';
type DeliveryStatus = 'En attente' | 'Acceptée' | 'En cours' | 'Livrée' | 'Refusée';

type LivraisonRow = {
  id: string;
  reference: string;
  product: string;
  weightKg: number;
  type: DeliveryType;
  status: DeliveryStatus;
  createdAt: string;
  ownerId?: number;
};

@Component({
  selector: 'app-delivery-livraisons-list',
  standalone: false,
  templateUrl: './delivery-livraisons-list.component.html',
  styleUrls: ['./delivery-livraisons-list.component.css']
})
export class DeliveryLivraisonsListComponent implements OnInit {
  role = getDeliveryUserRole();
  private currentUserId = this.requestService.getCurrentUserId();

  constructor(private router: Router, private requestService: DeliveryRequestService) {}

  statuses: Array<DeliveryStatus | 'Tous'> = ['Tous', 'En attente', 'Acceptée', 'En cours', 'Livrée', 'Refusée'];
  types: Array<DeliveryType | 'Tous'> = ['Tous', 'Locale', 'Longue distance'];

  selectedStatus: DeliveryStatus | 'Tous' = 'Tous';
  selectedType: DeliveryType | 'Tous' = 'Tous';
  searchText = '';

  page = 1;
  pageSize = 8;
  notification: string | null = null;

  deliveries: LivraisonRow[] = this.mapRequestsToRows(this.requestService.getAll());

  ngOnInit(): void {
    this.requestService.refreshFromBackend().subscribe((rows) => {
      this.deliveries = this.mapRequestsToRows(rows);
      this.goFirst();
    });
  }

  get filteredDeliveries(): LivraisonRow[] {
    const q = this.searchText.trim().toLowerCase();
    return this.deliveries.filter((d) => {
      const ownerOk = !this.isFarmer() || d.ownerId === this.currentUserId;
      const sOk = this.selectedStatus === 'Tous' || d.status === this.selectedStatus;
      const tOk = this.selectedType === 'Tous' || d.type === this.selectedType;
      const qOk = !q || (d.reference + ' ' + d.product + ' ' + d.status).toLowerCase().includes(q);
      return ownerOk && sOk && tOk && qOk;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDeliveries.length / this.pageSize));
  }

  get pagedDeliveries(): LivraisonRow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredDeliveries.slice(start, start + this.pageSize);
  }

  goFirst(): void {
    this.page = 1;
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages, this.page + 1);
  }

  prevPage(): void {
    this.page = Math.max(1, this.page - 1);
  }

  consult(id: string): void {
    this.router.navigate(['/delivery/livraisons', id]);
  }

  goTracking(): void {
    this.router.navigate(['/delivery/tracking']);
  }

  edit(id: string): void {
    this.router.navigate(['/delivery/livraisons', id, 'edit']);
  }

  delete(id: string): void {
    const ok = window.confirm('Delete this delivery?');
    if (!ok) return;
    this.requestService.deleteApiDelivery(id).subscribe((deleted) => {
      if (!deleted) {
        this.notification = `Deletion of ${id} failed.`;
      } else {
        this.deliveries = this.deliveries.filter((delivery) => delivery.id !== id);
        this.notification = `Delivery ${id} deleted successfully.`;
      }
      window.setTimeout(() => (this.notification = null), 3000);
    });
  }

  isAdmin(): boolean {
    return this.role.includes('admin');
  }

  isFarmer(): boolean {
    return this.role === 'agriculteur' || this.role === 'farmer' || this.role.includes('agric');
  }

  private mapRequestsToRows(requests: DeliveryRequest[]): LivraisonRow[] {
    return requests.map((r, index) => ({
      id: r.id,
      reference: r.reference,
      product: r.product,
      weightKg: r.weightKg,
      type: r.weightKg >= 250 ? 'Longue distance' : 'Locale',
      status: r.status as DeliveryStatus,
      createdAt: this.toShortDate(r.createdAt),
      ownerId: r.createdById || index + 1
    }));
  }

  private toShortDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('fr-FR');
  }
}
