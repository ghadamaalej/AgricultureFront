import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
import { DisponibiliteService } from '../../../services/disponibilite/disponibilite.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-my-visit-reservations',
  standalone: false,
  templateUrl: './my-visit-reservations.component.html',
  styleUrls: ['./my-visit-reservations.component.css']
})
export class MyVisitReservationsComponent implements OnInit {

  reservations: any[] = [];
  filteredReservations: any[] = [];

  searchTerm: string = '';
  selectedStatus: string = 'ALL';
  selectedTab: string = 'ALL';

  loading = false;
  errorMessage = '';

  currentUserId: number | null = null;

  editOpen = false;
  editingReservation: any = null;

  selectedDay = '';
  selectedDate = '';
  selectedSlot: any = null;

  filteredAvailabilities: any[] = [];

  proposalOpen = false;
  selectedProposalReservation: any = null;

  proposalDateDebut = '';
  proposalDateFin = '';
  proposalNbMois = 0;
  proposalTotal = 0;

  rentalProposals: any[] = [];

  daysOfWeek = [
    { label: 'Monday', value: 'LUNDI' },
    { label: 'Tuesday', value: 'MARDI' },
    { label: 'Wednesday', value: 'MERCREDI' },
    { label: 'Thursday', value: 'JEUDI' },
    { label: 'Friday', value: 'VENDREDI' },
    { label: 'Saturday', value: 'SAMEDI' },
    { label: 'Sunday', value: 'DIMANCHE' }
  ];

  showReservationPopup = false;
  reservationPopupTitle = '';
  reservationPopupMessage = '';
  reservationPopupType: 'success' | 'error' = 'success';

  constructor(
    private reservationVisiteService: ReservationVisiteService,
    private disponibiliteService: DisponibiliteService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

    if (!this.currentUserId) {
      this.errorMessage = 'Please sign in first to view your reservations.';
      return;
    }

    this.loadReservations();
    this.loadRentalProposals();
  }

  goBack(): void {
    this.router.navigate(['/marketplace']);
  }

  loadReservations(): void {
    if (!this.currentUserId) {
      this.errorMessage = 'Please sign in first to view your reservations.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.reservationVisiteService.getByUser(this.currentUserId).subscribe({
      next: (data: any) => {
        this.reservations = Array.isArray(data) ? data : [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Impossible to load your reservations.';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let result = [...this.reservations];

    if (this.selectedStatus !== 'ALL') {
      result = result.filter(r => this.getStatus(r) === this.selectedStatus);
    }

    if (this.selectedTab === 'UPCOMING') {
      result = result.filter(r => this.isUpcoming(r));
    } else if (this.selectedTab === 'PAST') {
      result = result.filter(r => !this.isUpcoming(r));
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(r =>
        this.getArticleName(r).toLowerCase().includes(term) ||
        this.getLocationName(r).toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(`${this.getVisitDate(a)}T${this.getStartTime(a)}`).getTime();
      const dateB = new Date(`${this.getVisitDate(b)}T${this.getStartTime(b)}`).getTime();
      return dateB - dateA;
    });

    this.filteredReservations = result;
  }

  setTab(tab: string): void {
    this.selectedTab = tab;
    this.applyFilters();
  }

  getStatus(r: any): string {
    return r.status || r.statut || 'PENDING';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'CONFIRMED':
      case 'CONFIRMEE':
        return 'status-confirmed';

      case 'REFUSED':
      case 'REFUSEE':
        return 'status-refused';

      case 'CANCELLED':
      case 'ANNULEE':
        return 'status-cancelled';

      case 'DONE':
      case 'TERMINEE':
        return 'status-done';

      default:
        return 'status-pending';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED':
      case 'CONFIRMEE':
        return 'Confirmed';

      case 'REFUSED':
      case 'REFUSEE':
        return 'Refused';

      case 'CANCELLED':
      case 'ANNULEE':
        return 'Cancelled';

      case 'DONE':
      case 'TERMINEE':
        return 'Done';

      default:
        return 'Pending';
    }
  }

  getArticleName(r: any): string {
    return (
      r.location?.nom ||
      r.nom ||
      (r.location?.type === 'terrain' ? 'Land Rental' : 'Machine Rental')
    );
  }

  getLocationName(r: any): string {
    return (
      r.location?.localisation ||
      r.localisation ||
      'Not specified'
    );
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

  getVisitDate(r: any): string {
    return r.dateVisite || '';
  }

  getStartTime(r: any): string {
    return r.heureDebut || '';
  }

  getEndTime(r: any): string {
    return r.heureFin || '';
  }

  isUpcoming(r: any): boolean {
    const date = this.getVisitDate(r);
    const time = this.getStartTime(r);

    if (!date || !time) return false;

    return new Date(`${date}T${time}`).getTime() >= Date.now();
  }

  getTotalCount(): number {
    return this.reservations.length;
  }

  getCountByStatus(status: string): number {
    return this.reservations.filter(r => this.getStatus(r) === status).length;
  }

  canEditReservation(reservation: any): boolean {
    const status = this.getStatus(reservation);
    return status === 'PENDING' || status === 'EN_ATTENTE';
  }

  getDayValueFromDate(dateStr: string): string {
    if (!dateStr) return '';

    const jsDay = new Date(dateStr).getDay();

    const map: any = {
      0: 'DIMANCHE',
      1: 'LUNDI',
      2: 'MARDI',
      3: 'MERCREDI',
      4: 'JEUDI',
      5: 'VENDREDI',
      6: 'SAMEDI'
    };

    return map[jsDay] || '';
  }

  editReservation(reservation: any): void {
    if (!this.currentUserId) {
      this.openReservationPopup(
        'Update Failed',
        'Please sign in first.',
        'error'
      );
      return;
    }

    if (!this.canEditReservation(reservation)) {
      this.openReservationPopup(
        'Update Failed',
        'Only pending reservations can be updated.',
        'error'
      );
      return;
    }

    this.editingReservation = reservation;
    this.editOpen = true;

    this.selectedDate = this.getVisitDate(reservation);
    this.selectedDay = this.getDayValueFromDate(this.selectedDate);
    this.selectedSlot = null;
    this.filteredAvailabilities = [];

    const locationId =
      reservation.location?.id ||
      reservation.locationId ||
      reservation.idLocation;

    if (!locationId || !this.selectedDay) return;

    this.disponibiliteService.getByLocationAndDay(locationId, this.selectedDay).subscribe({
      next: (data: any[]) => {
        this.filteredAvailabilities = Array.isArray(data) ? data : [];

        const existingSlot = this.filteredAvailabilities.find((slot: any) =>
          slot.heureDebut === this.getStartTime(reservation) &&
          slot.heureFin === this.getEndTime(reservation)
        );

        if (existingSlot) {
          this.selectedSlot = existingSlot;
        }
      },
      error: (err) => {
        console.error('Error loading availabilities:', err);
        this.filteredAvailabilities = [];
      }
    });
  }

  selectEditSlot(slot: any): void {
    this.selectedSlot = slot;
  }

  isSelectedDateMatchingDay(): boolean {
    if (!this.selectedDate || !this.selectedDay) return false;

    const jsDay = new Date(this.selectedDate).getDay();

    const map: any = {
      DIMANCHE: 0,
      LUNDI: 1,
      MARDI: 2,
      MERCREDI: 3,
      JEUDI: 4,
      VENDREDI: 5,
      SAMEDI: 6
    };

    return jsDay === map[this.selectedDay];
  }

  closeEditForm(): void {
    this.editOpen = false;
    this.editingReservation = null;
    this.selectedDay = '';
    this.selectedDate = '';
    this.selectedSlot = null;
    this.filteredAvailabilities = [];
  }

  openReservationPopup(title: string, message: string, type: 'success' | 'error' = 'success') {
    this.reservationPopupTitle = title;
    this.reservationPopupMessage = message;
    this.reservationPopupType = type;
    this.showReservationPopup = true;
  }

  closeReservationPopup() {
    this.showReservationPopup = false;
  }

  confirmUpdateReservation(): void {
    if (!this.currentUserId) {
      this.openReservationPopup('Update Failed', 'Please sign in first.', 'error');
      return;
    }

    if (!this.editingReservation) {
      this.openReservationPopup('Update Failed', 'Reservation not found.', 'error');
      return;
    }

    if (!this.canEditReservation(this.editingReservation)) {
      this.openReservationPopup('Update Failed', 'Only pending reservations can be updated.', 'error');
      return;
    }

    if (!this.selectedDay) {
      this.openReservationPopup('Update Failed', 'Please choose a day.', 'error');
      return;
    }

    if (!this.selectedDate) {
      this.openReservationPopup('Update Failed', 'Please choose a visit date.', 'error');
      return;
    }

    if (!this.selectedSlot) {
      this.openReservationPopup('Update Failed', 'Please choose a time slot.', 'error');
      return;
    }

    if (!this.isSelectedDateMatchingDay()) {
      this.openReservationPopup(
        'Update Failed',
        'Selected date does not match the chosen day.',
        'error'
      );
      return;
    }

    if (!this.isSelectedSlotStillValid()) {
      this.openReservationPopup(
        'Update Failed',
        'Please choose a valid available time slot.',
        'error'
      );
      return;
    }

    const payload = {
      dateVisite: this.selectedDate,
      heureDebut: this.selectedSlot.heureDebut,
      heureFin: this.selectedSlot.heureFin
    };

    this.reservationVisiteService.update(this.editingReservation.id, payload).subscribe({
      next: () => {
        this.closeEditForm();
        this.loadReservations();

        this.openReservationPopup(
          'Reservation Updated',
          'Your visit reservation has been updated successfully.',
          'success'
        );
      },
      error: (err) => {
        console.error('Update error:', err);

        this.openReservationPopup(
          'Update Failed',
          'This reservation could not be updated. The selected slot may already be booked or unavailable.',
          'error'
        );
      }
    });
  }

  selectEditDay(day: string): void {
    this.selectedDay = day;
    this.selectedSlot = null;

    if (!this.editingReservation) return;

    const locationId =
      this.editingReservation.location?.id ||
      this.editingReservation.locationId ||
      this.editingReservation.idLocation;

    if (!locationId) {
      this.filteredAvailabilities = [];
      return;
    }

    this.disponibiliteService.getByLocationAndDay(locationId, day).subscribe({
      next: (data: any[]) => {
        this.filteredAvailabilities = data || [];
      },
      error: (err) => {
        console.error('Error loading availabilities:', err);
        this.filteredAvailabilities = [];
      }
    });
  }

  onEditDateChange(): void {
    if (!this.selectedDate) return;

    const newDay = this.getDayValueFromDate(this.selectedDate);

    if (newDay !== this.selectedDay) {
      this.selectedDay = newDay;
      this.selectedSlot = null;
      this.loadSlotsForCurrentEditDay();
    }
  }

  loadSlotsForCurrentEditDay(): void {
    if (!this.editingReservation || !this.selectedDay) {
      this.filteredAvailabilities = [];
      return;
    }

    const locationId =
      this.editingReservation.location?.id ||
      this.editingReservation.locationId ||
      this.editingReservation.idLocation;

    if (!locationId) {
      this.filteredAvailabilities = [];
      return;
    }

    this.disponibiliteService.getByLocationAndDay(locationId, this.selectedDay).subscribe({
      next: (data: any[]) => {
        this.filteredAvailabilities = Array.isArray(data) ? data : [];
      },
      error: (err) => {
        console.error('Error loading availabilities:', err);
        this.filteredAvailabilities = [];
      }
    });
  }

  isSelectedSlotStillValid(): boolean {
    if (!this.selectedSlot) return false;

    return this.filteredAvailabilities.some((slot: any) =>
      slot.heureDebut === this.selectedSlot.heureDebut &&
      slot.heureFin === this.selectedSlot.heureFin
    );
  }

  canDeleteReservation(reservation: any): boolean {
    const status = this.getStatus(reservation);
    return status === 'PENDING' || status === 'EN_ATTENTE';
  }

  deleteReservation(reservation: any): void {
    if (!this.currentUserId) {
      this.openReservationPopup(
        'Delete Failed',
        'Please sign in first.',
        'error'
      );
      return;
    }

    if (!this.canDeleteReservation(reservation)) {
      this.openReservationPopup(
        'Delete Failed',
        'Only pending reservations can be deleted.',
        'error'
      );
      return;
    }

    if (!reservation?.id) {
      this.openReservationPopup(
        'Delete Failed',
        'Reservation not found.',
        'error'
      );
      return;
    }

    this.reservationVisiteService.deleteReservation(reservation.id).subscribe({
      next: () => {
        this.openReservationPopup(
          'Reservation Deleted',
          'Your reservation has been deleted successfully.',
          'success'
        );
        this.loadReservations();
      },
      error: (err) => {
        console.error('Delete error:', err);
        this.openReservationPopup(
          'Delete Failed',
          'Unable to delete this reservation.',
          'error'
        );
      }
    });
  }
  

openRentalProposalForm(reservation: any): void {
  this.selectedProposalReservation = reservation;
  this.proposalDateDebut = '';
  this.proposalDateFin = '';
  this.proposalNbMois = 0;
  this.proposalTotal = 0;
  this.proposalOpen = true;
}

closeRentalProposalForm(): void {
  this.proposalOpen = false;
  this.selectedProposalReservation = null;
  this.proposalDateDebut = '';
  this.proposalDateFin = '';
  this.proposalNbMois = 0;
  this.proposalTotal = 0;
}

updateProposalSummary(): void {
  if (!this.proposalDateDebut || !this.proposalDateFin) {
    this.proposalNbMois = 0;
    this.proposalTotal = 0;
    return;
  }

  const start = new Date(this.proposalDateDebut);
  const end = new Date(this.proposalDateFin);

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  const sameDay = end.getDate() === start.getDate();

  if (!sameDay || months < 1) {
    this.proposalNbMois = 0;
    this.proposalTotal = 0;
    return;
  }

  this.proposalNbMois = months;

  const monthlyPrice = this.selectedProposalReservation?.location?.prix || 0;
  this.proposalTotal = monthlyPrice * months;
}

isWholeMonthRange(startStr: string, endStr: string): boolean {
  if (!startStr || !endStr) return false;

  const start = new Date(startStr);
  const end = new Date(endStr);

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  return end.getDate() === start.getDate() && months >= 1;
}

confirmRentalProposal(): void {
  if (!this.currentUserId) {
    this.openReservationPopup('Proposal Failed', 'Please sign in first.', 'error');
    return;
  }

  if (this.hasProposalForReservation(this.selectedProposalReservation)) {
    this.openReservationPopup(
      'Proposal Failed',
      'You already sent a rental proposal for this reservation.',
      'error'
    );
    return;
  }

  if (!this.selectedProposalReservation?.id) {
    this.openReservationPopup('Proposal Failed', 'Reservation not found.', 'error');
    return;
  }

  if (!this.proposalDateDebut || !this.proposalDateFin) {
    this.openReservationPopup('Proposal Failed', 'Please choose start and end dates.', 'error');
    return;
  }

  if (!this.isWholeMonthRange(this.proposalDateDebut, this.proposalDateFin)) {
    this.openReservationPopup(
      'Proposal Failed',
      'Rental period must be whole months only, with a minimum of 1 month.',
      'error'
    );
    return;
  }

  const rental = this.selectedProposalReservation?.location;
  if (rental?.dateDebutLocation && this.proposalDateDebut < rental.dateDebutLocation) {
    this.openReservationPopup(
      'Proposal Failed',
      'Start date must be within rental availability.',
      'error'
    );
    return;
  }

  if (rental?.dateFinLocation && this.proposalDateFin > rental.dateFinLocation) {
    this.openReservationPopup(
      'Proposal Failed',
      'End date must be within rental availability.',
      'error'
    );
    return;
  }

  const payload = {
    dateDebut: this.proposalDateDebut,
    dateFin: this.proposalDateFin
  };

  this.reservationVisiteService.createRentalProposal(
    this.selectedProposalReservation.id,
    this.currentUserId,
    payload
  ).subscribe({
    next: () => {
      this.closeRentalProposalForm();
      this.loadRentalProposals();

      this.openReservationPopup(
        'Proposal Sent',
        'Your rental proposal has been sent to the farmer.',
        'success'
      );
    },
    error: (err) => {
      this.openReservationPopup(
        'Proposal Failed',
        err?.error?.message || 'Unable to create rental proposal.',
        'error'
      );
    }
  });
}

loadRentalProposals(): void {
  if (!this.currentUserId) return;

  this.reservationVisiteService.getProposalsByLocataire(this.currentUserId).subscribe({
    next: (data: any) => {
      this.rentalProposals = Array.isArray(data) ? data : [];
    },
    error: (err) => {
      console.error('Error loading rental proposals:', err);
      this.rentalProposals = [];
    }
  });
}

hasProposalForReservation(reservation: any): boolean {
  if (!reservation?.id) return false;

  return this.rentalProposals.some(p => p.reservationId === reservation.id);
}

canProposeRental(reservation: any): boolean {
  const status = this.getStatus(reservation);
  const isCompleted = status === 'TERMINEE' || status === 'DONE';

  return isCompleted && !this.hasProposalForReservation(reservation);
}

getProposalButtonLabel(reservation: any): string {
  return this.hasProposalForReservation(reservation)
    ? 'Rental Already Proposed'
    : 'Propose Rental';
}

getProposalRentalName(): string {
  const r = this.selectedProposalReservation?.location;
  if (!r) return 'Rental';

  return r.nom || (r.type === 'terrain' ? 'Land Rental' : 'Machine Rental');
}

getProposalRentalImage(): string {
  const r = this.selectedProposalReservation?.location;
  const imageName = r?.image || r?.photo || r?.locationImage;

  return imageName
    ? 'http://localhost:8090/uploads/' + imageName
    : 'assets/images/product1.jpg';
}

getProposalAvailabilityText(): string {
  const r = this.selectedProposalReservation?.location;
  const start = r?.dateDebutLocation || '-';
  const end = r?.dateFinLocation || '-';

  return `${start} → ${end}`;
}

getProposalExtraLabel(): string {
  const r = this.selectedProposalReservation?.location;
  if (!r) return 'Details';

  return r.type === 'terrain' ? 'Region' : 'Brand';
}

getProposalExtraValue(): string {
  const r = this.selectedProposalReservation?.location;
  if (!r) return '-';

  if (r.type === 'terrain') {
    return r.localisation || '-';
  }

  return r.marque || '-';
}
}