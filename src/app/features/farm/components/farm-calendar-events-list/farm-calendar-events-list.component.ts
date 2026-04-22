import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CalendarEvent } from '../../models/calendar.model';
import { getEventTypeLabel } from '../../utils/calendar-labels';

@Component({
  selector: 'app-farm-calendar-events-list',
  standalone: false,
  templateUrl: './farm-calendar-events-list.component.html',
  styleUrls: ['./farm-calendar-events-list.component.css']
})
export class FarmCalendarEventsListComponent {
  @Input() events: CalendarEvent[] = [];

  @Output() editEvent = new EventEmitter<CalendarEvent>();
  @Output() deleteEvent = new EventEmitter<number>();

  labelType(code: string): string {
    return getEventTypeLabel(code);
  }
}
