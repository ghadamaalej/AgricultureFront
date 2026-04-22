import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardLayoutComponent } from './dashboard-layout/dashboard-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { MarketplaceAdminComponent } from './marketplace-admin/marketplace-admin.component';
import { DashboardEventComponent } from './dashboard-event/dashboard-event.component';

@NgModule({
  declarations: [
    DashboardLayoutComponent,
    DashboardComponent,
    MarketplaceAdminComponent,

    DashboardEventComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DashboardRoutingModule
  ]
})
export class DashboardModule { }