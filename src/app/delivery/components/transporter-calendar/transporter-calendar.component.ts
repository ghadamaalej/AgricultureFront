import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { DeliveryExtendedService, CalendarDay, CalendarSummary, CalendarItem } from '../../services/delivery-extended.service';

type CalendarCell = {
  day: CalendarDay | null;
};

@Component({
  selector: 'app-transporter-calendar',
  templateUrl: './transporter-calendar.component.html',
  styleUrls: ['./transporter-calendar.component.css']
})
export class TransporterCalendarComponent implements OnInit, OnChanges {
  @Input() transporteurId: number = 0;
  @Input() year: number = new Date().getFullYear();
  @Input() month: number = new Date().getMonth() + 1;
  
  @Output() dateSelected = new EventEmitter<string>();
  @Output() deliverySelected = new EventEmitter<CalendarItem>();

  calendarDays: CalendarDay[] = [];
  calendarCells: CalendarCell[] = [];
  calendarSummary: CalendarSummary | null = null;
  isLoading: boolean = false;
  selectedDate: string | null = null;
  selectedDayDetails: CalendarDay | null = null;
  readonly weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Pour la navigation
  currentYear: number = new Date().getFullYear();
  currentMonth: number = new Date().getMonth() + 1;

  constructor(private deliveryService: DeliveryExtendedService) {}

  ngOnInit(): void {
    this.currentYear = this.year;
    this.currentMonth = this.month;
    this.loadCalendar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const transporteurChanged = changes['transporteurId'] && !changes['transporteurId'].firstChange;
    const yearChanged = changes['year'] && !changes['year'].firstChange;
    const monthChanged = changes['month'] && !changes['month'].firstChange;

    if (yearChanged) {
      this.currentYear = this.year;
    }

    if (monthChanged) {
      this.currentMonth = this.month;
    }

    if (transporteurChanged || yearChanged || monthChanged) {
      this.loadCalendar();
    }
  }

  loadCalendar(): void {
    if (!this.transporteurId) {
      this.calendarDays = this.normalizeCalendarDays([]);
      this.calendarCells = this.buildCalendarCells(this.calendarDays);
      this.calendarSummary = this.createEmptySummary();
      this.syncSelectedDay();
      return;
    }
    
    this.isLoading = true;
    
    // Charger les deux en parallèle
    this.deliveryService.getTransporterCalendar(this.transporteurId, this.currentYear, this.currentMonth).subscribe({
      next: (days) => {
        this.calendarDays = this.normalizeCalendarDays(days);
        this.calendarCells = this.buildCalendarCells(this.calendarDays);
        this.syncSelectedDay();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du calendrier:', err);
        this.calendarDays = this.normalizeCalendarDays([]);
        this.calendarCells = this.buildCalendarCells(this.calendarDays);
        this.syncSelectedDay();
        this.isLoading = false;
      }
    });

    this.deliveryService.getTransporterCalendarSummary(this.transporteurId, this.currentYear, this.currentMonth).subscribe({
      next: (summary) => {
        this.calendarSummary = summary || this.createEmptySummary();
      },
      error: (err) => {
        console.error('Erreur lors du chargement du résumé:', err);
        this.calendarSummary = this.createEmptySummary();
      }
    });
  }

  navigateMonth(direction: 'prev' | 'next'): void {
    if (direction === 'prev') {
      this.currentMonth--;
      if (this.currentMonth < 1) {
        this.currentMonth = 12;
        this.currentYear--;
      }
    } else {
      this.currentMonth++;
      if (this.currentMonth > 12) {
        this.currentMonth = 1;
        this.currentYear++;
      }
    }
    this.loadCalendar();
  }

  goToCurrentMonth(): void {
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth() + 1;
    this.loadCalendar();
  }

  selectDate(day: CalendarDay): void {
    this.selectedDate = day.date;
    this.selectedDayDetails = day;
    this.dateSelected.emit(day.date);
  }

  selectDelivery(item: CalendarItem): void {
    this.deliverySelected.emit(item);
  }

  getMonthName(): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[this.currentMonth - 1];
  }

  getDayName(dateStr: string): string {
    const date = this.parseLocalDate(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }

  getDayNumber(dateStr: string): number {
    return this.parseLocalDate(dateStr).getDate();
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'EN_ATTENTE': 'clock',
      'ACCEPTEE': 'check-circle',
      'EN_COURS': 'truck',
      'RETARD': 'exclamation-triangle',
      'LIVREE': 'check-double',
      'ANNULEE': 'times-circle'
    };
    return icons[status] || 'question-circle';
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'EN_ATTENTE': '#FF9800',
      'ACCEPTEE': '#4CAF50',
      'EN_COURS': '#2196F3',
      'RETARD': '#F44336',
      'LIVREE': '#8BC34A',
      'ANNULEE': '#9E9E9E'
    };
    return colors[status] || '#9E9E9E';
  }

  getDayStatusColor(day: CalendarDay): string {
    if (day.livrees > 0 && day.enCours === 0 && day.acceptees === 0) {
      return '#8BC34A'; // Tout livré - vert
    } else if (day.enCours > 0) {
      return '#2196F3'; // En cours - bleu
    } else if (day.acceptees > 0) {
      return '#FF9800'; // Accepté - orange
    } else if (day.hasDeliveries) {
      return '#9E9E9E'; // Autre statuts - gris
    }
    return 'transparent';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(price);
  }

  formatDate(dateStr: string): string {
    const date = this.parseLocalDate(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  isToday(dateStr: string): boolean {
    const today = new Date();
    const date = this.parseLocalDate(dateStr);
    return date.toDateString() === today.toDateString();
  }

  isPast(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = this.parseLocalDate(dateStr);
    return date < today;
  }

  isFuture(dateStr: string): boolean {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const date = this.parseLocalDate(dateStr);
    return date > today;
  }

  getDeliveryPriority(priority: number): string {
    if (priority >= 5) return 'high';
    if (priority >= 3) return 'medium';
    return 'low';
  }

  getTotalDeliveriesCount(): number {
    return this.calendarSummary?.totalDeliveries || 0;
  }

  getTotalRevenue(): number {
    return this.calendarSummary?.totalRevenue || 0;
  }

  getCompletionRate(): number {
    return this.calendarSummary?.completionRate || 0;
  }

  formatTime(value?: string): string {
    if (!value) {
      return '--:--';
    }

    if (value.includes('T')) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
    }

    return value.slice(0, 5);
  }

  formatDuration(minutes?: number): string {
    const safeMinutes = Number(minutes || 0);
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    if (hours <= 0) {
      return `${remainingMinutes} min`;
    }
    return `${hours}h${String(remainingMinutes).padStart(2, '0')}`;
  }

  getLoadRatio(day: CalendarDay): number {
    const total = Number(day.totalEstimatedMinutes || 0);
    const capacity = Number(day.capacityMinutes || 0);
    if (!capacity) {
      return 0;
    }
    return Math.min((total / capacity) * 100, 100);
  }

  getLoadLabel(day: CalendarDay): string {
    const total = Number(day.totalEstimatedMinutes || 0);
    const capacity = Number(day.capacityMinutes || 0);
    if (!capacity || !total) {
      return 'Empty schedule';
    }
    return `${this.formatDuration(total)} / ${this.formatDuration(capacity)}`;
  }

  hasPlanningConflict(day: CalendarDay | null | undefined): boolean {
    return Boolean(day?.hasConflict);
  }

  getGroupsCount(day: CalendarDay | null | undefined): number {
    return Number(day?.groupsCount || 0);
  }

  getDaysWithDeliveries(): number {
    return this.calendarSummary?.daysWithDeliveries || 0;
  }

  trackByCalendarCell(index: number): number {
    return index;
  }

  private syncSelectedDay(): void {
    if (!this.selectedDate) {
      this.selectedDayDetails = null;
      return;
    }

    const matchingDay = this.calendarDays.find((day) => day.date === this.selectedDate) || null;
    this.selectedDayDetails = matchingDay;

    if (!matchingDay) {
      this.selectedDate = null;
    }
  }

  private normalizeCalendarDays(days: CalendarDay[] | null | undefined): CalendarDay[] {
    const incomingDays = days || [];
    const monthStart = new Date(this.currentYear, this.currentMonth - 1, 1);
    const lastDayOfMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const dayMap = new Map(incomingDays.map((day) => [day.date, day]));
    const normalizedDays: CalendarDay[] = [];

    for (let dayNumber = 1; dayNumber <= lastDayOfMonth; dayNumber += 1) {
      const date = new Date(this.currentYear, this.currentMonth - 1, dayNumber);
      const isoDate = this.formatIsoDate(date);
      const existingDay = dayMap.get(isoDate);

      normalizedDays.push(existingDay || this.createEmptyDay(isoDate, date));
    }

    if (normalizedDays.length === 0) {
      normalizedDays.push(this.createEmptyDay(this.formatIsoDate(monthStart), monthStart));
    }

    return normalizedDays;
  }

  private buildCalendarCells(days: CalendarDay[]): CalendarCell[] {
    if (!days.length) {
      return [];
    }

    const firstDayOffset = this.getFirstDayOffset(days[0].date);
    const cells: CalendarCell[] = Array.from({ length: firstDayOffset }, () => ({ day: null }));

    days.forEach((day) => {
      cells.push({ day });
    });

    const trailingCells = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailingCells; i += 1) {
      cells.push({ day: null });
    }

    return cells;
  }

  private getFirstDayOffset(dateStr: string): number {
    const dayIndex = this.parseLocalDate(dateStr).getDay();
    return (dayIndex + 6) % 7;
  }

  private createEmptyDay(dateStr: string, date: Date): CalendarDay {
    return {
      date: dateStr,
      jourSemaine: this.getDayName(dateStr).toUpperCase(),
      hasDeliveries: false,
      totalDeliveries: 0,
      groupsCount: 0,
      enCours: 0,
      acceptees: 0,
      livrees: 0,
      revenueJour: 0,
      items: [],
      totalEstimatedMinutes: 0,
      totalServiceMinutes: 0,
      totalTransitionMinutes: 0,
      capacityMinutes: 24 * 60,
      remainingMinutes: 24 * 60,
      overlapCount: 0,
      overloadMinutes: 0,
      hasConflict: false,
      projectedEndTime: undefined,
      warningMessage: '',
      isToday: this.isSameDate(date, new Date()),
      isPast: this.isBeforeToday(date),
      isFuture: this.isAfterToday(date)
    };
  }

  private createEmptySummary(): CalendarSummary {
    return {
      month: this.currentMonth,
      year: this.currentYear,
      totalDays: this.calendarDays.length || new Date(this.currentYear, this.currentMonth, 0).getDate(),
      daysWithDeliveries: 0,
      totalDeliveries: 0,
      totalEnCours: 0,
      totalAcceptees: 0,
      totalLivrees: 0,
      totalRevenue: 0,
      averageDeliveriesPerDay: 0,
      completionRate: 0
    };
  }

  private parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isSameDate(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private isBeforeToday(date: Date): boolean {
    const candidate = new Date(date);
    candidate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return candidate < today;
  }

  private isAfterToday(date: Date): boolean {
    const candidate = new Date(date);
    candidate.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return candidate > today;
  }
}
