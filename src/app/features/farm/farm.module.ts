import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { FarmRoutingModule } from './farm-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { FarmAddComponent } from './pages/farm-add/farm-add.component';
import { FarmListComponent } from './pages/farm-list/farm-list.component';
import { Farm3dComponent } from './pages/farm-3d/farm-3d.component';
import { TerrainFormComponent } from './components/terrain-form/terrain-form.component';
import { FarmCalendarComponent } from './pages/farm-calendar/farm-calendar.component';
import { FarmCalendarMonthComponent } from './components/farm-calendar-month/farm-calendar-month.component';
import { FarmCalendarEventsListComponent } from './components/farm-calendar-events-list/farm-calendar-events-list.component';
import { FarmCalendarWeatherComponent } from './components/farm-calendar-weather/farm-calendar-weather.component';
import { FarmCalendarFaoComponent } from './components/farm-calendar-fao/farm-calendar-fao.component';
import { FarmCalendarClimateComponent } from './components/farm-calendar-climate/farm-calendar-climate.component';

@NgModule({
  declarations: [
    FarmAddComponent,
    FarmListComponent,
    Farm3dComponent,
    TerrainFormComponent,
    FarmCalendarComponent,
    FarmCalendarMonthComponent,
    FarmCalendarEventsListComponent,
    FarmCalendarWeatherComponent,
    FarmCalendarFaoComponent,
    FarmCalendarClimateComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    FarmRoutingModule,
    SharedModule
  ]
})
export class FarmModule { }