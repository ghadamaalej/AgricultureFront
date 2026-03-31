import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CalendarDayCell, CalendarEvent } from '../../models/calendar.model';
import { getEventTypeLabel } from '../../utils/calendar-labels';

@Component({
  selector: 'app-farm-calendar-month',
  standalone: false,
  templateUrl: './farm-calendar-month.component.html',
  styleUrls: ['./farm-calendar-month.component.css']
})
export class FarmCalendarMonthComponent {
  @Input() monthLabel = '';
  @Input() weekDays: string[] = [];
  @Input() calendarDays: CalendarDayCell[] = [];
  @Input() events: CalendarEvent[] = [];
  @Input() selectedDateKey = '';

  @Output() monthPrevious = new EventEmitter<void>();
  @Output() monthNext = new EventEmitter<void>();
  @Output() daySelect = new EventEmitter<CalendarDayCell>();
  @Output() editEvent = new EventEmitter<CalendarEvent>();
  @Output() deleteEvent = new EventEmitter<number>();

  getEventsForDay(dateKey: string): CalendarEvent[] {
    return this.events.filter((e) => e.date === dateKey);
  }

  hasEvents(dateKey: string): boolean {
    return this.getEventsForDay(dateKey).length > 0;
  }

  isSelectedDay(dateKey: string): boolean {
    return this.selectedDateKey === dateKey;
  }

  labelType(code: string): string {
    return getEventTypeLabel(code);
  }
}
