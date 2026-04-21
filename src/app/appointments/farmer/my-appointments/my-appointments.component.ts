import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AppointmentResponse, AppointmentStatus, AppointmentStats } from '../../models/appointments.models';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-my-appointments',
  standalone: false,
  templateUrl: './my-appointments.component.html',
  styleUrls: ['./my-appointments.component.css']
})
export class MyAppointmentsComponent implements OnInit {
  @Output() switchView = new EventEmitter<string>();

  appointments: AppointmentResponse[] = [];
  loading = true;
  error = '';
  cancellingId: number | null = null;
  stats: AppointmentStats | null = null;

  constructor(private api: AppointmentsApiService, private auth: AuthService) {}

  ngOnInit() { this.load(); }

  load() {
  this.loading = true;
  const id = this.auth.getCurrentUserId()!;

  this.api.getFarmerAppointments(id).subscribe({
    next: a => {
      this.appointments = a;

      this.api.getFarmerStats(id).subscribe({
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
      this.error = e.status === 0
        ? 'Serveur inaccessible (port 8088).'
        : e.error?.message || 'Erreur de chargement';
    }
  });
}

  cancel(appt: AppointmentResponse) {
    if (!confirm('Annuler ce rendez-vous ?')) return;
    this.cancellingId = appt.id;
    this.api.cancelAppointment(appt.id).subscribe({
      next: () => { this.cancellingId = null; this.load(); },
      error: () => { this.cancellingId = null; }
    });
  }

  canCancel(appt: AppointmentResponse) {
    return appt.appointmentStatus === 'EN_ATTENTE' || appt.appointmentStatus === 'ACCEPTEE';
  }

  statusLabel(s: AppointmentStatus) {
    return { EN_ATTENTE:'En attente', ACCEPTEE:'Acceptée', REFUSEE:'Refusée', ANNULEE:'Annulée' }[s] || s;
  }
  statusClass(s: AppointmentStatus) {
    return { EN_ATTENTE:'st-wait', ACCEPTEE:'st-ok', REFUSEE:'st-refused', ANNULEE:'st-cancelled' }[s] || '';
  }

  statusIcon(s: AppointmentStatus) {
    return {
      EN_ATTENTE: 'fas fa-hourglass-half',
      ACCEPTEE:   'fas fa-check',
      REFUSEE:    'fas fa-times',
      ANNULEE:    'fas fa-ban'
    }[s] || 'fas fa-circle';
  }

  trackById(_: number, a: AppointmentResponse) { return a.id; }
}
