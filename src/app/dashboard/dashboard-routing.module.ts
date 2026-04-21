import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardLayoutComponent } from './dashboard-layout/dashboard-layout.component';
import { DashboardComponent }       from './dashboard/dashboard.component';
import { UsersComponent } from './users/users.component';

const routes: Routes = [
  {
    path: '',component: DashboardLayoutComponent,
    children: [
      { path: '',            component: DashboardComponent, pathMatch: 'full' },
      // ↓ Décommente au fur et à mesure que tu crées les modules
       {
          path: 'users',component: UsersComponent
          
        }
      // {
      //   path: 'deliveries',
      //   loadChildren: () =>
      //     import('./delivery-admin/delivery-admin.module').then(m => m.DeliveryAdminModule)
      // },
      // {
      //   path: 'events',
      //   loadChildren: () =>
      //     import('./events-admin/events-admin.module').then(m => m.EventsAdminModule)
      // },
      // {
      //   path: 'loans',
      //   loadChildren: () =>
      //     import('./loans-admin/loans-admin.module').then(m => m.LoansAdminModule)
      // },
      // {
      //   path: 'marketplace',
      //   loadChildren: () =>
      //     import('./marketplace-admin/marketplace-admin.module').then(m => m.MarketplaceAdminModule)
      // },
      // {
      //   path: 'forums',
      //   loadChildren: () =>
      //     import('./forums-admin/forums-admin.module').then(m => m.ForumsAdminModule)
      // },
      // {
      //   path: 'training',
      //   loadChildren: () =>
      //     import('./training-admin/training-admin.module').then(m => m.TrainingAdminModule)
      // },
      { path: '**', redirectTo: '' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }