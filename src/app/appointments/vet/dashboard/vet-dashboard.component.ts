import { Component, OnInit } from '@angular/core';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AppointmentResponse, AppointmentStatus, AppointmentStats } from '../../models/appointments.models';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-vet-dashboard',
  standalone: false,
  templateUrl: './vet-dashboard.component.html',
  styleUrls: ['./vet-dashboard.component.css']
})
export class VetDashboardComponent implements OnInit {
  all: AppointmentResponse[] = [];
  filtered: AppointmentResponse[] = [];
  loading = true;
  error = '';
  filterStatus: AppointmentStatus | 'ALL' = 'ALL';
  actionLoading: number | null = null;
  stats: AppointmentStats | null = null;

  // Refuse modal
  showRefuseModal = false;
  refuseAppt: AppointmentResponse | null = null;
  refuseReason = '';

  filters: { label: string; value: AppointmentStatus | 'ALL' }[] = [
    { label:'Tous',        value:'ALL'       },
    { label:'En attente',  value:'EN_ATTENTE' },
    { label:'Acceptés',    value:'ACCEPTEE'   },
    { label:'Refusés',     value:'REFUSEE'    },
    { label:'Annulés',     value:'ANNULEE'    },
  ];

  constructor(private api: AppointmentsApiService, private auth: AuthService) {}

  ngOnInit() { this.load(); }

  
   load() {
  this.loading = true;
  const id = this.auth.getCurrentUserId()!;

  this.api.getVetAppointments(id).subscribe({
    next: a => {
      this.all = a.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      this.applyFilter();

      this.api.getVetStats(id).subscribe({
        next: s => {
          this.stats = s;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    },
    error: e => {
      this.loading = false;
      this.error = e.status === 0 ? 'Serveur inaccessible.' : e.error?.message || 'Erreur';
    }
  });
}
  

  setFilter(f: AppointmentStatus | 'ALL') { this.filterStatus = f; this.applyFilter(); }
  applyFilter() {
    this.filtered = this.filterStatus === 'ALL'
      ? this.all
      : this.all.filter(a => a.appointmentStatus === this.filterStatus);
  }

  accept(a: AppointmentResponse) {
    this.actionLoading = a.id;
    this.api.acceptAppointment(a.id).subscribe({
      next: () => { this.actionLoading = null; this.load(); },
      error: () => { this.actionLoading = null; }
    });
  }

  openRefuse(a: AppointmentResponse) { this.refuseAppt = a; this.refuseReason = ''; this.showRefuseModal = true; }
  closeRefuse() { this.showRefuseModal = false; this.refuseAppt = null; }

  confirmRefuse() {
    if (!this.refuseAppt || !this.refuseReason.trim()) return;
    this.actionLoading = this.refuseAppt.id;
    this.api.refuseAppointment(this.refuseAppt.id, this.refuseReason).subscribe({
      next: () => { this.actionLoading = null; this.closeRefuse(); this.load(); },
      error: () => { this.actionLoading = null; }
    });
  }

  cancel(a: AppointmentResponse) {
    if (!confirm('Annuler ce rendez-vous ?')) return;
    this.actionLoading = a.id;
    this.api.cancelAppointment(a.id).subscribe({
      next: () => { this.actionLoading = null; this.load(); },
      error: () => { this.actionLoading = null; }
    });
  }

  statusLabel(s: AppointmentStatus) {
    return { EN_ATTENTE:'En attente', ACCEPTEE:'Accepté', REFUSEE:'Refusé', ANNULEE:'Annulé' }[s] || s;
  }
  statusClass(s: AppointmentStatus) {
    return { EN_ATTENTE:'st-wait', ACCEPTEE:'st-ok', REFUSEE:'st-refused', ANNULEE:'st-cancelled' }[s] || '';
  }

  count(s: AppointmentStatus | 'ALL') {
    return s === 'ALL' ? this.all.length : this.all.filter(a => a.appointmentStatus === s).length;
  }

  trackById(_: number, a: AppointmentResponse) { return a.id; }
}
