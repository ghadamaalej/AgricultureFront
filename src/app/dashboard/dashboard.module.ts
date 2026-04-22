import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardRoutingModule }    from './dashboard-routing.module';
import { DashboardLayoutComponent }  from './dashboard-layout/dashboard-layout.component';
import { DashboardComponent }        from './dashboard/dashboard.component';

@NgModule({
  declarations: [
    DashboardLayoutComponent,
    DashboardComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    DashboardRoutingModule
  ]
})
export class DashboardModule { }