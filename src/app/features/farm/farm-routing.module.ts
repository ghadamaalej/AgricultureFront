import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FarmAddComponent } from './pages/farm-add/farm-add.component';
import { FarmListComponent } from './pages/farm-list/farm-list.component';
import { Farm3dComponent } from './pages/farm-3d/farm-3d.component';
import { FarmCalendarComponent } from './pages/farm-calendar/farm-calendar.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'add',
    component: FarmAddComponent,
    data: { title: 'Ajouter un Terrain' }
  },
  {
    path: 'list',
    component: FarmListComponent,
    data: { title: 'Mes Terrains' }
  },
  {
    path: '3d/:id',
    component: Farm3dComponent,
    data: { title: 'Vue 3D du Terrain' }
  },
  {
    path: 'calendar',
    component: FarmCalendarComponent,
    data: { title: 'Calendrier Agricole' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FarmRoutingModule { }