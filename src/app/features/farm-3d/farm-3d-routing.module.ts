import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Farm3dPageComponent } from './pages/farm-3d-page/farm-3d-page.component';

const routes: Routes = [
  {
    path: '',
    component: Farm3dPageComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class Farm3dRoutingModule { }