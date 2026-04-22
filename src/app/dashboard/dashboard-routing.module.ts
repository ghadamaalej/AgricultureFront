import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardLayoutComponent } from './dashboard-layout/dashboard-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { UsersComponent } from './users/users.component';
import { MarketplaceAdminComponent } from './marketplace-admin/marketplace-admin.component';
import { DashboardEventComponent } from './dashboard-event/dashboard-event.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      { path: '', component: DashboardComponent, pathMatch: 'full' },

      {
        path: 'claims',
        loadChildren: () =>
          import('../claims/claims-admin.module').then(m => m.ClaimsAdminModule)
      },

      { path: 'users', component: UsersComponent },
      { path: 'marketplace', component: MarketplaceAdminComponent },
      { path: 'events', component: DashboardEventComponent },

      { path: '**', redirectTo: '' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }