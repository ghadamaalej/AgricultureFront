import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { InventoryApiService } from '../../../inventory/services/inventory-api.service';
import { VetUser, VetAvailability, TimeSlot } from '../../models/appointments.models';
import { Animal } from '../../../inventory/models/inventory.models';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-vet-profile',
  standalone: false,
  templateUrl: './vet-profile.component.html',
  styleUrls: ['./vet-profile.component.css']
})
export class VetProfileComponent implements OnInit {
  @Input() vet!: VetUser;
  @Output() back   = new EventEmitter<void>();
  @Output() booked = new EventEmitter<void>();
  @Output() openChat = new EventEmitter<number>();

  availabilities: VetAvailability[] = [];
  animals: Animal[] = [];
  loading = true;

  calDate = new Date();
  calDays: { date: Date; valid: boolean; past: boolean }[] = [];
  selectedDate: string | null = null;
  slotsForDate: TimeSlot[] = [];
  selectedSlot: TimeSlot | null = null;

  step: 'calendar' | 'slots' | 'form' | 'done' = 'calendar';
  showShop = false;
  bookingLoading = false;
  bookingError = '';

  animalReferenceCtrl = new FormControl('', Validators.required);
  motifCtrl = new FormControl('', Validators.required);

  form = new FormGroup({
    animalReference: this.animalReferenceCtrl,
    motif: this.motifCtrl,
  });

  weekDays = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

  constructor(private api: AppointmentsApiService, private invApi: InventoryApiService, private toast: ToastService) {}

  ngOnInit() {
    this.api.getVetAvailabilities(this.vet.id).subscribe({
      next: a => { this.availabilities = a; this.loading = false; this.buildCal(); },
      error: () => { this.loading = false; }
    });
    this.invApi.getMyAnimals().subscribe({ next: a => this.animals = a });
  }

  buildCal() {
    const y = this.calDate.getFullYear(), m = this.calDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const days: { date: Date; valid: boolean; past: boolean }[] = [];
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 0; i < firstDay; i++) {
      days.push({ date: new Date(0), valid: false, past: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const iso = this.toIso(date);
      const isPast = date.getTime() < todayStart.getTime();
      const hasSlot = this.availabilities.some(a =>
        a.date === iso && (a.timeSlots || []).some(s => s.status === 'AVAILABLE')
      );
      days.push({ date, valid: hasSlot && !isPast, past: isPast });
    }
    this.calDays = days;
  }

  prevMonth() { this.calDate = new Date(this.calDate.getFullYear(), this.calDate.getMonth() - 1, 1); this.buildCal(); }
  nextMonth() { this.calDate = new Date(this.calDate.getFullYear(), this.calDate.getMonth() + 1, 1); this.buildCal(); }

  selectDay(day: { date: Date; valid: boolean; past: boolean }) {
    if (!day.valid || day.past || !day.date.getTime()) return;
    this.selectedDate = this.toIso(day.date);
    const av = this.availabilities.find(a => a.date === this.selectedDate);
    this.slotsForDate = (av?.timeSlots || []).filter(s => s.status === 'AVAILABLE');
    this.selectedSlot = null;
    this.step = 'slots';
  }

  pickSlot(s: TimeSlot) { this.selectedSlot = s; this.step = 'form'; }
  backToCalendar()       { this.step = 'calendar'; this.selectedDate = null; }
  backToSlots()          { this.step = 'slots'; this.selectedSlot = null; }

  submit() {
    if (this.form.invalid || !this.selectedSlot) { this.form.markAllAsTouched(); return; }
    const ref = this.form.value.animalReference!.trim();
    const animal = this.animals.find(a => a.reference.toLowerCase() === ref.toLowerCase());
    if (!animal) { this.bookingError = `Aucun animal avec la référence "${ref}" trouvé.`; return; }

    this.bookingLoading = true;
    this.bookingError = '';
    this.api.createAppointment({
      veterinarianId: this.vet.id,
      animalId: animal.id,
      timeSlotId: this.selectedSlot.id,
      motif: this.form.value.motif!,
    }).subscribe({
      next: () => {
        this.bookingLoading = false;
        this.step = 'done';
        this.toast.success('Rendez-vous réservé avec succès !');
      },
      error: e => {
        this.bookingLoading = false;
        this.bookingError = e.error?.message || 'Erreur lors de la réservation';
        this.toast.error(this.bookingError);
      }
    });
  }

  finish() { this.booked.emit(); }

  toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  get monthLabel() {
    return this.calDate.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });
  }

  isToday(d: Date) {
    const t = new Date(); return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear();
  }

  get vetInitials(): string {
    return ((this.vet?.prenom?.charAt(0) || '') + (this.vet?.nom?.charAt(0) || '')).toUpperCase();
  }

  get animalReferencesList(): string {
    return this.animals.map(a => a.reference).join(', ');
  }

  get selectedDateFormatted(): string {
    if (!this.selectedDate) return '';
    const [y, m, d] = this.selectedDate.split('-');
    const date = new Date(+y, +m - 1, +d);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  get selectedSlotTime(): string {
    if (!this.selectedSlot) return '';
    return `${this.selectedSlot.startTime} – ${this.selectedSlot.endTime}`;
  }

  openConversation() { this.openChat.emit(this.vet.id); }
  openShop()  { this.showShop = true; }
  closeShop() { this.showShop = false; }

  get selectedDateDisplay(): string {
    if (!this.selectedDate) return '';
    const [y, m, d] = this.selectedDate.split('-');
    const date = new Date(+y, +m - 1, +d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
