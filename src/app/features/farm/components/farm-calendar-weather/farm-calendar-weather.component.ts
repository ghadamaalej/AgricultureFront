import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Terrain } from '../../models/terrain.model';
import { IrrigationAdvice, WeatherForecastDay } from '../../models/calendar.model';

@Component({
  selector: 'app-farm-calendar-weather',
  standalone: false,
  templateUrl: './farm-calendar-weather.component.html',
  styleUrls: ['./farm-calendar-weather.component.css']
})
export class FarmCalendarWeatherComponent {
  @Input() terrains: Terrain[] = [];
  @Input() selectedTerrainId: number | null = null;
  @Input() loading = false;
  @Input() error = '';
  @Input() weather: WeatherForecastDay[] = [];
  @Input() irrigationAdvice: IrrigationAdvice[] = [];

  @Output() terrainIdChange = new EventEmitter<number | null>();

  onTerrainChange(id: number | null): void {
    this.terrainIdChange.emit(id);
  }
}
