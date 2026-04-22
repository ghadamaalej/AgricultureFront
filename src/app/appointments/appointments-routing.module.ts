import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppointmentsLayoutComponent } from './layout/appointments-layout.component';
import { AuthGuard } from '../services/auth/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: AppointmentsLayoutComponent,
    canActivate: [AuthGuard],
    data: { roles: ['AGRICULTEUR', 'VETERINAIRE'] }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AppointmentsRoutingModule {}
