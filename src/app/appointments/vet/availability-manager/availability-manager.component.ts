import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { VetAvailability, UnavailabilityResponse } from '../../models/appointments.models';

type ActiveTab = 'availabilities' | 'unavailabilities' | 'block';

@Component({
  selector: 'app-availability-manager',
  standalone: false,
  templateUrl: './availability-manager.component.html',
  styleUrls: ['./availability-manager.component.css']
})
export class AvailabilityManagerComponent implements OnInit {
  tab: ActiveTab = 'availabilities';

  // Availabilities
  availabilities: VetAvailability[] = [];
  loadingAvail = true;

  // Availability form
  showAvailForm = false;
  availLoading  = false;
  availError    = '';
  availForm = new FormGroup({
    date:                 new FormControl('', Validators.required),
    startTime:            new FormControl('', Validators.required),
    endTime:              new FormControl('', Validators.required),
    slotDurationMinutes:  new FormControl(30,  [Validators.required, Validators.min(15)])
  });

  // Block day form
  blockDate    = '';
  blockLoading = false;
  blockError   = '';
  blockSuccess = false;

  // Unavailabilities
  unavailabilities: UnavailabilityResponse[] = [];
  loadingUnavail = true;
  showUnavailForm = false;
  unavailLoading  = false;
  unavailError    = '';
  unavailForm = new FormGroup({
    startDate:       new FormControl('', Validators.required),
    endDate:         new FormControl('', Validators.required),
    fullDay:         new FormControl(true),
    startTime:       new FormControl(''),
    endTime:         new FormControl(''),
    recurringWeekly: new FormControl(false),
    reason:          new FormControl('')
  });

  constructor(private api: AppointmentsApiService) {}

  ngOnInit() { this.loadAvail(); this.loadUnavail(); }

  setTab(t: ActiveTab) { this.tab = t; }

  // ── Availabilities ─────────────────────────────────────────
  loadAvail() {
    this.loadingAvail = true;
    this.api.getMyAvailabilities().subscribe({
      next: a => { this.availabilities = a; this.loadingAvail = false; },
      error: () => { this.loadingAvail = false; }
    });
  }

  submitAvail() {
    if (this.availForm.invalid) { this.availForm.markAllAsTouched(); return; }
    this.availLoading = true; this.availError = '';
    const v = this.availForm.value;
    this.api.createAvailability({
      date: v.date!, startTime: v.startTime!, endTime: v.endTime!,
      slotDurationMinutes: +v.slotDurationMinutes!
    }).subscribe({
      next: () => { this.availLoading = false; this.showAvailForm = false; this.availForm.reset({slotDurationMinutes:30}); this.loadAvail(); },
      error: e => { this.availLoading = false; this.availError = e.error?.message || 'Erreur'; }
    });
  }

  totalSlots(a: VetAvailability) { return (a.timeSlots || []).length; }
  availableSlots(a: VetAvailability) { return (a.timeSlots || []).filter(s => s.status === 'AVAILABLE').length; }

  // ── Block day ──────────────────────────────────────────────
  submitBlock() {
    if (!this.blockDate) return;
    this.blockLoading = true; this.blockError = ''; this.blockSuccess = false;
    this.api.blockDay(this.blockDate).subscribe({
      next: () => { this.blockLoading = false; this.blockSuccess = true; this.blockDate = ''; this.loadAvail(); },
      error: e => { this.blockLoading = false; this.blockError = e.error?.message || 'Erreur'; }
    });
  }

  // ── Unavailabilities ───────────────────────────────────────
  loadUnavail() {
    this.loadingUnavail = true;
    this.api.getMyUnavailabilities().subscribe({
      next: u => { this.unavailabilities = u; this.loadingUnavail = false; },
      error: () => { this.loadingUnavail = false; }
    });
  }

  submitUnavail() {
    if (this.unavailForm.invalid) { this.unavailForm.markAllAsTouched(); return; }
    this.unavailLoading = true; this.unavailError = '';
    const v = this.unavailForm.value;
    this.api.createUnavailability({
      startDate: v.startDate!, endDate: v.endDate!,
      fullDay: !!v.fullDay, recurringWeekly: !!v.recurringWeekly,
      startTime: v.fullDay ? null : (v.startTime || null),
      endTime:   v.fullDay ? null : (v.endTime   || null),
      reason: v.reason || null
    }).subscribe({
      next: () => { this.unavailLoading = false; this.showUnavailForm = false; this.unavailForm.reset({fullDay:true,recurringWeekly:false}); this.loadUnavail(); },
      error: e => { this.unavailLoading = false; this.unavailError = e.error?.message || 'Erreur'; }
    });
  }

  deleteUnavail(id: number) {
    if (!confirm('Supprimer cette indisponibilité ?')) return;
    this.api.deleteUnavailability(id).subscribe({ next: () => this.loadUnavail() });
  }

  get isFullDay() { return !!this.unavailForm.get('fullDay')?.value; }
  invalid(form: FormGroup, f: string) { const c = form.get(f); return c && c.invalid && c.touched; }
}
