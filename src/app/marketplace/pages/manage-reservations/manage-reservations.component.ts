import { Component, OnInit } from '@angular/core';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-manage-reservations',
  templateUrl: './manage-reservations.component.html',
  styleUrls: ['./manage-reservations.component.css']
})
export class ManageReservationsComponent implements OnInit {

  reservations: any[] = [];
  currentUserId: number | null = null;

  showPopup = false;
  popupTitle = '';
  popupMessage = '';
  popupType: 'success' | 'error' = 'success';

  selectedFilter = 'ALL';

  constructor(
    private reservationService: ReservationVisiteService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    this.loadReservations();
  }

  setFilter(filter: string) {
    this.selectedFilter = filter;
  }

  getFilteredReservations() {
    if (this.selectedFilter === 'ALL') return this.reservations;

    return this.reservations.filter(r => {
      const status = this.getStatus(r);

      if (this.selectedFilter === 'PENDING') {
        return status === 'EN_ATTENTE' || status === 'PENDING';
      }

      if (this.selectedFilter === 'CONFIRMED') {
        return status === 'CONFIRMEE' || status === 'CONFIRMED';
      }

      if (this.selectedFilter === 'REFUSED') {
        return status === 'ANNULEE' || status === 'REFUSED';
      }

      return true;
    });
  }

  getClientName(r: any): string {
    return 'Client #' + r.idUser;
  }

  loadReservations() {
    if (!this.currentUserId) return;

    this.reservationService.getByOwner(this.currentUserId).subscribe({
      next: (data: any) => {
        const reservationList = Array.isArray(data) ? data : [];

        this.reservations = reservationList.filter((r: any) =>
          r.location?.idUser === this.currentUserId
        );
      },
      error: (err) => {
        console.error('Load reservations error:', err);
        this.openPopup('Error', 'Failed to load reservations.', 'error');
      }
    });
  }

  getStatus(r: any) {
    return r.statut || r.status;
  }

  canManage(r: any) {
    const status = this.getStatus(r);
    return status === 'EN_ATTENTE' || status === 'PENDING';
  }

  confirm(r: any) {
    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    if (!this.canManage(r)) {
      this.openPopup('Error', 'Only pending reservations can be confirmed.', 'error');
      return;
    }

    this.reservationService.confirmReservation(r.id).subscribe({
      next: () => {
        this.openPopup('Success', 'Reservation confirmed', 'success');
        this.loadReservations();
      },
      error: () => {
        this.openPopup('Error', 'Failed to confirm reservation', 'error');
      }
    });
  }

  refuse(r: any) {
    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    if (!this.canManage(r)) {
      this.openPopup('Error', 'Only pending reservations can be refused.', 'error');
      return;
    }

    this.reservationService.refuseReservation(r.id).subscribe({
      next: () => {
        this.openPopup('Success', 'Reservation refused', 'success');
        this.loadReservations();
      },
      error: () => {
        this.openPopup('Error', 'Failed to refuse reservation', 'error');
      }
    });
  }

  openPopup(title: string, message: string, type: 'success' | 'error') {
    this.popupTitle = title;
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
  }

  getCountByStatus(status: string): number {
    return this.reservations.filter(r => this.getStatus(r) === status).length;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
      case 'PENDING':
        return 'status-pending';

      case 'CONFIRMEE':
      case 'CONFIRMED':
        return 'status-confirmed';

      case 'ANNULEE':
      case 'REFUSED':
        return 'status-refused';

      case 'TERMINEE':
      case 'DONE':
        return 'status-done';

      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
      case 'PENDING':
        return 'Pending';

      case 'CONFIRMEE':
      case 'CONFIRMED':
        return 'Accepted';

      case 'ANNULEE':
      case 'REFUSED':
        return 'Refused';

      case 'TERMINEE':
      case 'DONE':
        return 'Completed';

      default:
        return status;
    }
  }

  getImage(r: any): string {
    const imageName =
      r.location?.image ||
      r.image ||
      r.locationImage;

    return imageName
      ? 'http://localhost:8090/uploads/' + imageName
      : 'assets/images/product1.jpg';
  }

  goBack(): void {
    this.router.navigate(['/marketplace']);
  }
}