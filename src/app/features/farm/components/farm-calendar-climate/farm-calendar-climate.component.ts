import { Component, Input } from '@angular/core';
import { ClimateMonthSummary } from '../../models/calendar.model';

@Component({
  selector: 'app-farm-calendar-climate',
  standalone: false,
  templateUrl: './farm-calendar-climate.component.html',
  styleUrls: ['./farm-calendar-climate.component.css']
})
export class FarmCalendarClimateComponent {
  @Input() climateYear = '';
  @Input() climateLoading = false;
  @Input() climateMonthly: ClimateMonthSummary[] = [];
}
