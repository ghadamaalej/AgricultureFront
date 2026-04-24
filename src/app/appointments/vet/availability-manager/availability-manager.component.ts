import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { GoogleCalendarService } from '../../../inventory/services/google-calendar.service';
import { VetAvailability, UnavailabilityResponse } from '../../models/appointments.models';
import { AuthService } from '../../../services/auth/auth.service';

type ActiveTab = 'calendar' | 'unavailabilities' | 'block' | 'gcalendar';

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

// État de synchronisation Google Calendar
export type CalSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

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
    slotDurationMinutes: new FormControl(30, Validators.required),
    syncToCalendar: new FormControl(true)   // ← Google Calendar toggle
  });

  // Block day
  blockDate = '';
  blockLoading = false;
  blockError = '';
  blockSuccess = false;
  blockSyncToCalendar = true;              // ← Google Calendar toggle

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
    reason: new FormControl(''),
    syncToCalendar: new FormControl(true)  // ← Google Calendar toggle
  });

  // Statut Google Calendar (partagé entre les 3 actions)
  calSyncStatus: CalSyncStatus = 'idle';
  calSyncMessage = '';
  calEventLink = '';

  // ── Google Calendar Embed ────────────────
  gcalLoading = false;
  gcalAuthorized = false;
  gcalEmbedUrl: SafeResourceUrl | null = null;
  // Remplace par l'adresse email Google du vétérinaire connecté
  // Elle est visible dans Google Calendar → Paramètres → Intégrer un calendrier
  gcalEmail = '';

  weekDays = [
    { label: 'Lundi', value: 'MONDAY' },
    { label: 'Mardi', value: 'TUESDAY' },
    { label: 'Mercredi', value: 'WEDNESDAY' },
    { label: 'Jeudi', value: 'THURSDAY' },
    { label: 'Vendredi', value: 'FRIDAY' },
    { label: 'Samedi', value: 'SATURDAY' },
    { label: 'Dimanche', value: 'SUNDAY' }
  ];

  constructor(
    private api: AppointmentsApiService,
    private calendarService: GoogleCalendarService,
    private auth: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.loadAvail();
    this.loadUnavail();
    this.initUnavailFormBehavior();
  }

  // ── Comportements formulaire ─────────────
  initUnavailFormBehavior() {
    const fullDayCtrl    = this.unavailForm.get('fullDay');
    const recurringCtrl  = this.unavailForm.get('recurringWeekly');
    const startTimeCtrl  = this.unavailForm.get('startTime');
    const endTimeCtrl    = this.unavailForm.get('endTime');
    const dayOfWeekCtrl  = this.unavailForm.get('dayOfWeek');

    fullDayCtrl?.valueChanges.subscribe(isFullDay => {
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

    recurringCtrl?.valueChanges.subscribe(isRecurring => {
      if (isRecurring) {
        dayOfWeekCtrl?.setValidators([Validators.required]);
      } else {
        dayOfWeekCtrl?.clearValidators();
        dayOfWeekCtrl?.setValue(null);
      }
      dayOfWeekCtrl?.updateValueAndValidity();
    });
  }

  setTab(t: ActiveTab) { this.tab = t; this.resetCalSync(); }

  // ── Chargement ───────────────────────────
  loadAvail() {
    this.loadingAvail = true;
    this.api.getMyAvailabilities().subscribe({
      next: a => { this.availabilities = a; this.loadingAvail = false; this.buildCal(); },
      error: () => { this.loadingAvail = false; }
    });
  }

  loadUnavail() {
    this.loadingUnavail = true;
    this.api.getMyUnavailabilities().subscribe({
      next: u => { this.unavailabilities = u; this.loadingUnavail = false; },
      error: () => { this.loadingUnavail = false; }
    });
  }

  // ── Calendrier ───────────────────────────
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
      days.push(this.makeDay(date, this.toIso(date), false, todayIso));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      days.push(this.makeDay(date, this.toIso(date), true, todayIso));
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(y, m + 1, i);
      days.push(this.makeDay(date, this.toIso(date), false, todayIso));
    }
    this.calDays = days;
  }

  makeDay(date: Date, iso: string, isCurrent: boolean, todayIso: string): CalDay {
    const av = this.availabilities.find(a => a.date === iso) || null;
    const slots = av?.timeSlots || [];
    return {
      date, iso,
      isCurrentMonth: isCurrent,
      isToday: iso === todayIso,
      availability: av,
      totalSlots: slots.length,
      freeSlots:   slots.filter(s => s.status === 'AVAILABLE').length,
      bookedSlots: slots.filter(s => s.status === 'BOOKED').length,
      blockedSlots:slots.filter(s => s.status === 'BLOCKED').length
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

  openAddForm() { this.showAvailForm = true; this.availError = ''; this.resetCalSync(); }

  // ════════════════════════════════════════════
  //  SOUMETTRE DISPONIBILITÉ
  // ════════════════════════════════════════════
  submitAvail() {
    if (this.availForm.invalid) { this.availForm.markAllAsTouched(); return; }

    this.availLoading = true;
    this.availError = '';
    this.resetCalSync();

    const v = this.availForm.value;

    this.api.createAvailability({
      date: v.date!,
      startTime: v.startTime!,
      endTime: v.endTime!,
      slotDurationMinutes: +v.slotDurationMinutes!
    }).subscribe({
      next: () => {
        this.availLoading = false;

        if (v.syncToCalendar) {
          // Sync Google Calendar : disponibilité
          this.calSyncStatus = 'syncing';
          this.calSyncMessage = 'Synchronisation avec Google Calendar…';

          this.calendarService.createAvailabilityEvent({
            date: v.date!,
            startTime: v.startTime!,
            endTime: v.endTime!,
            slotDurationMinutes: +v.slotDurationMinutes!,
            vetName: this.getVetName()
          }).subscribe({
            next: (resp) => {
              this.calSyncStatus = 'success';
              this.calEventLink = resp.htmlLink;
              this.calSyncMessage = '✅ Événement ajouté dans Google Calendar';
              setTimeout(() => {
                this.showAvailForm = false;
                this.availForm.reset({ slotDurationMinutes: 30, syncToCalendar: true });
                this.resetCalSync();
                this.loadAvail();
              }, 2000);
            },
            error: () => {
              this.calSyncStatus = 'error';
              this.calSyncMessage = '⚠️ Disponibilité enregistrée, mais la sync Calendar a échoué.';
              setTimeout(() => {
                this.showAvailForm = false;
                this.availForm.reset({ slotDurationMinutes: 30, syncToCalendar: true });
                this.resetCalSync();
                this.loadAvail();
              }, 3000);
            }
          });
        } else {
          this.showAvailForm = false;
          this.availForm.reset({ slotDurationMinutes: 30, syncToCalendar: true });
          this.loadAvail();
        }
      },
      error: e => {
        this.availLoading = false;
        this.availError = this.extractErrorMessage(e, 'Erreur lors de la creation de la disponibilite');
      }
    });
  }

  // ════════════════════════════════════════════
  //  BLOQUER UN JOUR
  // ════════════════════════════════════════════
  submitBlock() {
    if (!this.blockDate) return;

    this.blockLoading = true;
    this.blockError = '';
    this.blockSuccess = false;
    this.resetCalSync();

    this.api.blockDay(this.blockDate).subscribe({
      next: () => {
        this.blockLoading = false;
        this.blockSuccess = true;

        if (this.blockSyncToCalendar) {
          this.calSyncStatus = 'syncing';
          this.calSyncMessage = 'Synchronisation avec Google Calendar…';

          this.calendarService.createBlockDayEvent({
            date: this.blockDate,
            vetName: this.getVetName()
          }).subscribe({
            next: (resp) => {
              this.calSyncStatus = 'success';
              this.calEventLink = resp.htmlLink;
              this.calSyncMessage = '✅ Jour bloqué ajouté dans Google Calendar';
              this.blockDate = '';
              this.loadAvail();
            },
            error: () => {
              this.calSyncStatus = 'error';
              this.calSyncMessage = '⚠️ Jour bloqué, mais la sync Calendar a échoué.';
              this.blockDate = '';
              this.loadAvail();
            }
          });
        } else {
          this.blockDate = '';
          this.loadAvail();
        }
      },
      error: e => {
        this.blockLoading = false;
        this.blockError = this.extractErrorMessage(e, 'Erreur lors du blocage du jour');
      }
    });
  }

  // ════════════════════════════════════════════
  //  VALIDATION CHEVAUCHEMENT
  // ════════════════════════════════════════════

  hasOverlap(newStart: string, newEnd: string): UnavailabilityResponse | null {
    const ns = new Date(newStart).getTime();
    const ne = new Date(newEnd).getTime();
    return this.unavailabilities.find(u => {
      const es = new Date(u.startDate).getTime();
      const ee = new Date(u.endDate).getTime();
      return ns <= ee && ne >= es;
    }) || null;
  }

  overlapMessage(u: UnavailabilityResponse): string {
    const same = u.startDate === u.endDate;
    const dates = same
      ? `le ${this.formatDate(u.startDate)}`
      : `du ${this.formatDate(u.startDate)} au ${this.formatDate(u.endDate)}`;
    const reason = u.reason ? ` (${u.reason})` : '';
    return `Chevauchement avec une indisponibilité existante ${dates}${reason}.`;
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  //  SOUMETTRE INDISPONIBILITÉ
  // ════════════════════════════════════════════
  submitUnavail() {
    if (this.unavailForm.invalid) { this.unavailForm.markAllAsTouched(); return; }

    const v = this.unavailForm.value;

    // ── Validation dates ──
    if (v.startDate! > v.endDate!) {
      this.unavailError = 'La date de début doit être antérieure ou égale à la date de fin.';
      return;
    }

    // ── Validation chevauchement ──
    const conflict = this.hasOverlap(v.startDate!, v.endDate!);
    if (conflict) {
      this.unavailError = this.overlapMessage(conflict);
      return;
    }

    this.unavailLoading = true;
    this.unavailError = '';
    this.resetCalSync();

    this.api.createUnavailability({
      startDate: v.startDate!,
      endDate: v.endDate!,
      fullDay: !!v.fullDay,
      recurringWeekly: !!v.recurringWeekly,
      dayOfWeek: v.recurringWeekly ? (v.dayOfWeek || null) : null,
      startTime: v.fullDay ? null : (v.startTime || null),
      endTime:   v.fullDay ? null : (v.endTime   || null),
      reason: v.reason || null
    }).subscribe({
      next: () => {
        this.unavailLoading = false;

        if (v.syncToCalendar) {
          this.calSyncStatus = 'syncing';
          this.calSyncMessage = 'Synchronisation avec Google Calendar…';

          this.calendarService.createUnavailabilityEvent({
            startDate: v.startDate!,
            endDate:   v.endDate!,
            fullDay:   !!v.fullDay,
            startTime: v.fullDay ? null : (v.startTime || null),
            endTime:   v.fullDay ? null : (v.endTime   || null),
            recurringWeekly: !!v.recurringWeekly,
            dayOfWeek: v.dayOfWeek || null,
            reason:    v.reason || null,
            vetName:   this.getVetName()
          }).subscribe({
            next: (resp) => {
              this.calSyncStatus = 'success';
              this.calEventLink = resp.htmlLink;
              this.calSyncMessage = '✅ Indisponibilité ajoutée dans Google Calendar';
              setTimeout(() => {
                this.closeUnavailForm();
                this.resetCalSync();
                this.loadUnavail();
              }, 2000);
            },
            error: () => {
              this.calSyncStatus = 'error';
              this.calSyncMessage = '⚠️ Indisponibilité enregistrée, mais la sync Calendar a échoué.';
              setTimeout(() => {
                this.closeUnavailForm();
                this.resetCalSync();
                this.loadUnavail();
              }, 3000);
            }
          });
        } else {
          this.closeUnavailForm();
          this.loadUnavail();
        }
      },
      error: e => {
        this.unavailLoading = false;
        this.unavailError = this.extractErrorMessage(e, 'Erreur lors de la creation de l indisponibilite');
      }
    });
  }

  closeUnavailForm() {
    this.showUnavailForm = false;
    this.unavailForm.reset({ fullDay: true, recurringWeekly: false, dayOfWeek: null, syncToCalendar: true });
  }

  // ── Suppression indisponibilité ──────────
  deleteUnavail(id: number) {
    if (!confirm('Supprimer cette indisponibilité ?')) return;
    this.api.deleteUnavailability(id).subscribe({
      next: () => this.loadUnavail()
    });
  }

  // ── Helpers ──────────────────────────────
  resetCalSync() {
    this.calSyncStatus  = 'idle';
    this.calSyncMessage = '';
    this.calEventLink   = '';
  }

  /** Récupère le nom du vétérinaire connecté depuis AuthService si disponible */
  getVetName(): string {
    try {
      const user = (this.auth as any).getCurrentUser?.();
      if (user?.nom && user?.prenom) return `${user.prenom} ${user.nom}`;
    } catch { /* ignore */ }
    return '';
  }

  get isFullDay()        { return !!this.unavailForm.get('fullDay')?.value; }
  get isRecurringWeekly(){ return !!this.unavailForm.get('recurringWeekly')?.value; }

  invalid(form: FormGroup, f: string) {
    const c = form.get(f);
    return !!(c && c.invalid && c.touched);
  }

  toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  private extractErrorMessage(error: any, fallback: string): string {
    if (!error) {
      return fallback;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (error.error?.message && String(error.error.message).trim()) {
      return String(error.error.message);
    }

    if (error.error?.error && String(error.error.error).trim()) {
      return String(error.error.error);
    }

    if (error.message && String(error.message).trim()) {
      return String(error.message);
    }

    return fallback;
  }

  get monthLabel() {
    return this.calDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  get totalAvailabilities() { return this.availabilities.length; }
  // ── Google Calendar Embed ─────────────────
  /**
   * Lance OAuth2 puis construit l'URL d'embed avec le token.
   */
  authorizeAndEmbed() {
    this.gcalLoading = true;
    this.calendarService.authorize().then(_token => {
      this.gcalLoading = false;
      this.gcalAuthorized = true;
      const base = 'https://calendar.google.com/calendar/embed';
      const params = new URLSearchParams({
        ctz: 'Africa/Tunis',
        hl: 'fr',
        mode: 'MONTH',
        showTitle: '0',
        showNav: '1',
        showDate: '1',
        showPrint: '0',
        showTabs: '1',
        showCalendars: '1'
      });
      if (this.gcalEmail) params.set('src', this.gcalEmail);
      const url = `${base}?${params.toString()}`;
      this.gcalEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }).catch(() => {
      this.gcalLoading = false;
      this.gcalAuthorized = false;
    });
  }

}
