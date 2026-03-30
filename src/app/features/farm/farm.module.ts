import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { FarmRoutingModule } from './farm-routing.module';
import { FarmAddComponent } from './pages/farm-add/farm-add.component';
import { FarmListComponent } from './pages/farm-list/farm-list.component';
import { Farm3dComponent } from './pages/farm-3d/farm-3d.component';
import { TerrainFormComponent } from './components/terrain-form/terrain-form.component';
import { FarmCalendarComponent } from './pages/farm-calendar/farm-calendar.component';

@NgModule({
  declarations: [
    FarmAddComponent,
    FarmListComponent,
    Farm3dComponent,
    TerrainFormComponent,
    FarmCalendarComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    FarmRoutingModule
  ]
})
export class FarmModule { }