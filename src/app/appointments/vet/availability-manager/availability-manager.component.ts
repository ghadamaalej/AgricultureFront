import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { VetAvailability, UnavailabilityResponse } from '../../models/appointments.models';

type ActiveTab = 'calendar' | 'unavailabilities' | 'block';

type CalDay = {
  date: Date;
  iso: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  availability: VetAvailability | null;
  totalSlots: number;
  freeSlots: number;
  bookedSlots: number;
  blockedSlots: number;
};

@Component({
  selector: 'app-availability-manager',
  templateUrl: './availability-manager.component.html',
  styleUrls: ['./availability-manager.component.css']
})
export class AvailabilityManagerComponent implements OnInit {
  tab: ActiveTab = 'calendar';

  // Calendar
  availabilities: VetAvailability[] = [];
  loadingAvail = true;
  calDate = new Date();
  calDays: CalDay[] = [];
  selectedDay: CalDay | null = null;

  // Add availability
  showAvailForm = false;
  availLoading = false;
  availError = '';
  availForm = new FormGroup({
    date: new FormControl('', Validators.required),
    startTime: new FormControl('', Validators.required),
    endTime: new FormControl('', Validators.required),
    slotDurationMinutes: new FormControl(30, Validators.required)
  });

  // Block day
  blockDate = '';
  blockLoading = false;
  blockError = '';
  blockSuccess = false;

  // Unavailabilities
  unavailabilities: UnavailabilityResponse[] = [];
  loadingUnavail = true;
  showUnavailForm = false;
  unavailLoading = false;
  unavailError = '';

  unavailForm = new FormGroup({
    startDate: new FormControl('', Validators.required),
    endDate: new FormControl('', Validators.required),
    fullDay: new FormControl(true),
    startTime: new FormControl(''),
    endTime: new FormControl(''),
    recurringWeekly: new FormControl(false),
    dayOfWeek: new FormControl<string | null>(null),
    reason: new FormControl('')
  });

  weekDays = [
    { label: 'Lundi', value: 'MONDAY' },
    { label: 'Mardi', value: 'TUESDAY' },
    { label: 'Mercredi', value: 'WEDNESDAY' },
    { label: 'Jeudi', value: 'THURSDAY' },
    { label: 'Vendredi', value: 'FRIDAY' },
    { label: 'Samedi', value: 'SATURDAY' },
    { label: 'Dimanche', value: 'SUNDAY' }
  ];

  constructor(private api: AppointmentsApiService) {}

  ngOnInit() {
    this.loadAvail();
    this.loadUnavail();
    this.initUnavailFormBehavior();
  }

  initUnavailFormBehavior() {
    const fullDayCtrl = this.unavailForm.get('fullDay');
    const recurringCtrl = this.unavailForm.get('recurringWeekly');
    const startTimeCtrl = this.unavailForm.get('startTime');
    const endTimeCtrl = this.unavailForm.get('endTime');
    const dayOfWeekCtrl = this.unavailForm.get('dayOfWeek');

    fullDayCtrl?.valueChanges.subscribe((isFullDay) => {
      if (isFullDay) {
        startTimeCtrl?.clearValidators();
        endTimeCtrl?.clearValidators();
        startTimeCtrl?.setValue('');
        endTimeCtrl?.setValue('');
      } else {
        startTimeCtrl?.setValidators([Validators.required]);
        endTimeCtrl?.setValidators([Validators.required]);
      }

      startTimeCtrl?.updateValueAndValidity();
      endTimeCtrl?.updateValueAndValidity();
    });

    recurringCtrl?.valueChanges.subscribe((isRecurring) => {
      if (isRecurring) {
        dayOfWeekCtrl?.setValidators([Validators.required]);
      } else {
        dayOfWeekCtrl?.clearValidators();
        dayOfWeekCtrl?.setValue(null);
      }

      dayOfWeekCtrl?.updateValueAndValidity();
    });
  }

  setTab(t: ActiveTab) {
    this.tab = t;
  }

  loadAvail() {
    this.loadingAvail = true;
    this.api.getMyAvailabilities().subscribe({
      next: a => {
        this.availabilities = a;
        this.loadingAvail = false;
        this.buildCal();
      },
      error: () => {
        this.loadingAvail = false;
      }
    });
  }

  buildCal() {
    const y = this.calDate.getFullYear();
    const m = this.calDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const todayIso = this.toIso(today);
    const days: CalDay[] = [];

    let startPad = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = startPad - 1; i >= 0; i--) {
      const date = new Date(y, m, -i);
      const iso = this.toIso(date);
      days.push(this.makeDay(date, iso, false, todayIso));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const iso = this.toIso(date);
      days.push(this.makeDay(date, iso, true, todayIso));
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(y, m + 1, i);
      const iso = this.toIso(date);
      days.push(this.makeDay(date, iso, false, todayIso));
    }

    this.calDays = days;
  }

  makeDay(date: Date, iso: string, isCurrent: boolean, todayIso: string): CalDay {
    const av = this.availabilities.find(a => a.date === iso) || null;
    const slots = av?.timeSlots || [];
    return {
      date,
      iso,
      isCurrentMonth: isCurrent,
      isToday: iso === todayIso,
      availability: av,
      totalSlots: slots.length,
      freeSlots: slots.filter(s => s.status === 'AVAILABLE').length,
      bookedSlots: slots.filter(s => s.status === 'BOOKED').length,
      blockedSlots: slots.filter(s => s.status === 'BLOCKED').length
    };
  }

  prevMonth() {
    this.calDate = new Date(this.calDate.getFullYear(), this.calDate.getMonth() - 1, 1);
    this.buildCal();
  }

  nextMonth() {
    this.calDate = new Date(this.calDate.getFullYear(), this.calDate.getMonth() + 1, 1);
    this.buildCal();
  }

  selectDay(day: CalDay) {
    this.selectedDay = this.selectedDay?.iso === day.iso ? null : day;
    this.availForm.patchValue({ date: day.iso });
  }

  openAddForm() {
    this.showAvailForm = true;
    this.availError = '';
  }

  submitAvail() {
    if (this.availForm.invalid) {
      this.availForm.markAllAsTouched();
      return;
    }

    this.availLoading = true;
    this.availError = '';

    const v = this.availForm.value;
    this.api.createAvailability({
      date: v.date!,
      startTime: v.startTime!,
      endTime: v.endTime!,
      slotDurationMinutes: +v.slotDurationMinutes!
    }).subscribe({
      next: () => {
        this.availLoading = false;
        this.showAvailForm = false;
        this.availForm.reset({ slotDurationMinutes: 30 });
        this.loadAvail();
      },
      error: e => {
        this.availLoading = false;
        this.availError = e.error?.message || 'Erreur';
      }
    });
  }

  submitBlock() {
    if (!this.blockDate) return;

    this.blockLoading = true;
    this.blockError = '';
    this.blockSuccess = false;

    this.api.blockDay(this.blockDate).subscribe({
      next: () => {
        this.blockLoading = false;
        this.blockSuccess = true;
        this.blockDate = '';
        this.loadAvail();
      },
      error: e => {
        this.blockLoading = false;
        this.blockError = e.error?.message || 'Erreur';
      }
    });
  }

  loadUnavail() {
    this.loadingUnavail = true;
    this.api.getMyUnavailabilities().subscribe({
      next: u => {
        this.unavailabilities = u;
        this.loadingUnavail = false;
      },
      error: () => {
        this.loadingUnavail = false;
      }
    });
  }

  submitUnavail() {
    if (this.unavailForm.invalid) {
      this.unavailForm.markAllAsTouched();
      return;
    }

    this.unavailLoading = true;
    this.unavailError = '';

    const v = this.unavailForm.value;

    this.api.createUnavailability({
      startDate: v.startDate!,
      endDate: v.endDate!,
      fullDay: !!v.fullDay,
      recurringWeekly: !!v.recurringWeekly,
      dayOfWeek: v.recurringWeekly ? (v.dayOfWeek || null) : null,
      startTime: v.fullDay ? null : (v.startTime || null),
      endTime: v.fullDay ? null : (v.endTime || null),
      reason: v.reason || null
    }).subscribe({
      next: () => {
        this.unavailLoading = false;
        this.showUnavailForm = false;

        this.unavailForm.reset({
          fullDay: true,
          recurringWeekly: false,
          dayOfWeek: null,
          startTime: '',
          endTime: '',
          reason: ''
        });

        this.loadUnavail();
      },
      error: e => {
        this.unavailLoading = false;
        this.unavailError = e.error?.message || 'Erreur';
      }
    });
  }

  deleteUnavail(id: number) {
    if (!confirm('Supprimer cette indisponibilité ?')) return;
    this.api.deleteUnavailability(id).subscribe({
      next: () => this.loadUnavail()
    });
  }

  get isFullDay() {
    return !!this.unavailForm.get('fullDay')?.value;
  }

  get isRecurringWeekly() {
    return !!this.unavailForm.get('recurringWeekly')?.value;
  }

  invalid(form: FormGroup, f: string) {
    const c = form.get(f);
    return !!(c && c.invalid && c.touched);
  }

  toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get monthLabel() {
    return this.calDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  get totalAvailabilities() {
    return this.availabilities.length;
  }
}