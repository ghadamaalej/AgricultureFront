import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Terrain } from '../../models/terrain.model';
import { TerrainService } from '../../services/terrain.service';
import { AgriCalendarService } from '../../services/agri-calendar.service';
import {
  CalendarDayCell,
  CalendarEvent,
  EvenementCalendrierApi,
  EventTypeAgricole,
  IrrigationAdvice,
  PrioriteEvent,
  RappelApi,
  StatutEvent,
  WeatherForecastDay,
  ClimateMonthSummary
} from '../../models/calendar.model';
import { CalendarEventService } from '../../services/calendar-event.service';
import { AuthService } from '../../../../services/auth/auth.service';
import { EVENT_TYPE_OPTIONS } from '../../utils/calendar-labels';

@Component({
  selector: 'app-farm-calendar',
  templateUrl: './farm-calendar.component.html',
  styleUrls: ['./farm-calendar.component.css']
})
export class FarmCalendarComponent implements OnInit {
  readonly eventTypeOptions = EVENT_TYPE_OPTIONS;

  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  currentMonthDate = new Date();
  calendarDays: Array<{ date: Date; dateKey: string; inCurrentMonth: boolean }> = [];
  selectedDateKey = '';
  modalOpen = false;

  terrains: Terrain[] = [];
  selectedTerrainId: number | null = null;
  events: CalendarEvent[] = [];

  newEvent: Omit<CalendarEvent, 'id'> = {
    title: '',
    date: '',
    crop: 'SEMIS',
    notes: ''
  };

  editingEventId: number | null = null;
  reminderMinutes = 60;
  weather: WeatherForecastDay[] = [];
  irrigationAdvice: IrrigationAdvice[] = [];
  climateMonthly: ClimateMonthSummary[] = [];
  climateYear = '';
  climateLoading = false;
  loading = false;
  error = '';

  constructor(
    private terrainService: TerrainService,
    private agriCalendarService: AgriCalendarService,
    private calendarEventService: CalendarEventService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEvents();
    this.loadTerrains();
    this.buildCalendar();
  }

  loadTerrains(): void {
    this.terrainService.getAllTerrains().subscribe({
      next: (terrains) => {
        this.terrains = terrains;
        if (terrains.length > 0 && terrains[0].idTerrain) {
          this.selectedTerrainId = terrains[0].idTerrain;
          this.refreshAgriData();
        }
      },
      error: (err) => {
        console.error(err);
        this.error = 'Unable to load terrains for weather forecasts.';
      }
    });
  }

  refreshAgriData(): void {
    const terrain = this.terrains.find((t) => t.idTerrain === this.selectedTerrainId);
    if (!terrain) {
      return;
    }

    this.loading = true;
    this.climateLoading = true;
    this.error = '';
    this.agriCalendarService.getWeatherForecast(terrain.latitude, terrain.longitude).subscribe({
      next: (forecast) => {
        this.weather = forecast;
        this.irrigationAdvice = this.agriCalendarService.buildIrrigationAdvice(forecast);
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Unable to load weather data.';
        this.loading = false;
      }
    });

    this.agriCalendarService.getLocalClimateMonthly(terrain.latitude, terrain.longitude).subscribe({
      next: (rows) => {
        this.climateMonthly = rows;
        this.climateYear = `${new Date().getFullYear() - 1}`;
        this.climateLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.climateMonthly = [];
        this.climateLoading = false;
      }
    });
  }

  onTerrainIdChange(id: number | null): void {
    this.selectedTerrainId = id;
    this.refreshAgriData();
  }

  onNavbarAuth(mode: 'signin' | 'signup'): void {
    this.router.navigate(['/'], { queryParams: { openAuth: mode } });
  }

  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  saveEvent(): void {
    if (!this.newEvent.title || !this.newEvent.date || !this.newEvent.crop) {
      return;
    }

    const payload = this.toApiPayload(this.newEvent);

    if (this.editingEventId) {
      this.calendarEventService.updateEvent(this.editingEventId, payload).subscribe({
        next: () => {
          this.editingEventId = null;
          this.resetForm();
          this.loadEvents();
          this.modalOpen = false;
        },
        error: (err) => {
          console.error(err);
          this.error = 'Unable to update event in backend.';
        }
      });
    } else {
      this.calendarEventService.createEvent(payload).subscribe({
        next: (created) => {
          if (created.idEvent && this.reminderMinutes > 0) {
            const rappel: RappelApi = {
              delaiAvantMinutes: this.reminderMinutes,
              canal: 'APP'
            };
            this.calendarEventService.createRappel(created.idEvent, rappel).subscribe({
              error: (rappelErr) => {
                console.error(rappelErr);
              }
            });
          }

          this.resetForm();
          this.loadEvents();
          this.modalOpen = false;
        },
        error: (err) => {
          console.error(err);
          this.error = 'Unable to save event in backend.';
        }
      });
    }
  }

  editEvent(event: CalendarEvent): void {
    this.editingEventId = event.id;
    this.newEvent = {
      title: event.title,
      date: event.date,
      crop: this.normalizeEventTypeForForm(event.crop),
      notes: event.notes || ''
    };
    this.reminderMinutes = 60;
    this.selectedDateKey = event.date;
    this.modalOpen = true;
  }

  deleteEvent(id: number): void {
    this.calendarEventService.deleteEvent(id).subscribe({
      next: () => this.loadEvents(),
      error: (err) => {
        console.error(err);
        this.error = 'Unable to delete event.';
      }
    });
  }

  resetForm(): void {
    this.newEvent = { title: '', date: '', crop: 'SEMIS', notes: '' };
    this.reminderMinutes = 60;
    this.editingEventId = null;
  }

  get monthLabel(): string {
    return `${this.monthNames[this.currentMonthDate.getMonth()]} ${this.currentMonthDate.getFullYear()}`;
  }

  previousMonth(): void {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() - 1, 1);
    this.buildCalendar();
  }

  nextMonth(): void {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() + 1, 1);
    this.buildCalendar();
  }

  selectDay(day: CalendarDayCell): void {
    this.selectedDateKey = day.dateKey;
    this.editingEventId = null;
    this.newEvent = {
      title: '',
      date: day.dateKey,
      crop: 'SEMIS',
      notes: ''
    };
    this.reminderMinutes = 60;
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
    this.resetForm();
  }

  getEventsForDay(dateKey: string): CalendarEvent[] {
    return this.events.filter((event) => event.date === dateKey);
  }

  hasEvents(dateKey: string): boolean {
    return this.getEventsForDay(dateKey).length > 0;
  }

  isSelectedDay(dateKey: string): boolean {
    return this.selectedDateKey === dateKey;
  }

  private normalizeEventTypeForForm(code: string): EventTypeAgricole {
    const allowed: EventTypeAgricole[] = ['SEMIS', 'IRRIGATION', 'FERTILISATION', 'AUTRE'];
    const v = (code || '').trim().toUpperCase() as EventTypeAgricole;
    return allowed.includes(v) ? v : 'AUTRE';
  }

  private loadEvents(): void {
    const userId = this.authService.getCurrentUserId() ?? 1;
    this.calendarEventService.getAllEvents().subscribe({
      next: (rows) => {
        this.events = rows
          .filter((event) => event.userId === userId)
          .map((event) => this.fromApiEvent(event))
          .sort((a, b) => a.date.localeCompare(b.date));
        this.buildCalendar();
      },
      error: (err) => {
        console.error(err);
        this.error = 'Unable to load backend events.';
      }
    });
  }

  private fromApiEvent(row: EvenementCalendrierApi): CalendarEvent {
    const dateOnly = row.dateDebut ? row.dateDebut.split('T')[0] : '';
    return {
      id: Number(row.idEvent || 0),
      title: row.titre,
      date: dateOnly,
      crop: row.type,
      notes: row.description
    };
  }

  private buildCalendar(): void {
    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const days: Array<{ date: Date; dateKey: string; inCurrentMonth: boolean }> = [];

    for (let i = 0; i < startWeekDay; i++) {
      const date = new Date(year, month, 1 - (startWeekDay - i));
      days.push({ date, dateKey: this.toDateKey(date), inCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({ date, dateKey: this.toDateKey(date), inCurrentMonth: true });
    }

    while (days.length % 7 !== 0) {
      const date = new Date(year, month, daysInMonth + (days.length - (startWeekDay + daysInMonth)) + 1);
      days.push({ date, dateKey: this.toDateKey(date), inCurrentMonth: false });
    }

    this.calendarDays = days;
    if (!this.selectedDateKey) {
      const today = new Date();
      this.selectedDateKey = this.toDateKey(today);
    }
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toApiPayload(formEvent: Omit<CalendarEvent, 'id'>): EvenementCalendrierApi {
    const userId = this.authService.getCurrentUserId() ?? 1;
    const eventType = this.toEventType(formEvent.crop);
    const dateDebut = `${formEvent.date}T08:00:00`;
    const dateFin = `${formEvent.date}T09:00:00`;

    return {
      titre: formEvent.title,
      description: formEvent.notes || '',
      dateDebut,
      dateFin,
      type: eventType,
      priorite: 'NORMALE' as PrioriteEvent,
      statut: 'PLANIFIE' as StatutEvent,
      userId
    };
  }

  private toEventType(cropOrType: string): EventTypeAgricole {
    return this.normalizeEventTypeForForm(cropOrType);
  }
}
