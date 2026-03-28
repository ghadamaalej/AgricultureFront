import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FarmAddComponent } from './pages/farm-add/farm-add.component';
import { FarmListComponent } from './pages/farm-list/farm-list.component';
import { Farm3dComponent } from './pages/farm-3d/farm-3d.component';

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
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FarmRoutingModule { }