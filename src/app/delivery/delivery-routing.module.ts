import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DeliveryLayoutComponent } from './components/layout/delivery-layout.component';
import { DeliveryHomeComponent } from './components/home/delivery-home.component';
import { DeliveryCreateComponent } from './components/create/delivery-create.component';
import { DeliveryTrackingComponent } from './components/tracking/delivery-tracking.component';
import { DeliveryDemandesComponent } from './components/demandes/delivery-demandes.component';
import { DeliveryDashboardComponent } from './components/dashboard/delivery-dashboard.component';
import { DeliveryLivraisonsListComponent } from './components/livraisons/delivery-livraisons-list.component';
import { DeliveryLivraisonDetailComponent } from './components/livraisons/delivery-livraison-detail.component';
import { DeliveryAdminFormComponent } from './components/admin/delivery-admin-form.component';
import { DeliveryAdminOverviewComponent } from './components/admin/delivery-admin-overview.component';
import { DeliveryActiveComponent } from './components/active/delivery-active.component';
import { DeliveryActiveRouteComponent } from './components/active-route/delivery-active-route.component';
import { DeliveryHistoryComponent } from './components/history/delivery-history.component';
// Nouveaux composants
import { TransporterCalendarPageComponent } from './components/transporter-calendar-page/transporter-calendar-page.component';
import { TransporterStatsPageComponent } from './components/transporter-stats-page/transporter-stats-page.component';
import { GroupsManagementPageComponent } from './components/groups-management-page/groups-management-page.component';
import { DeliveryAdminRoleGuard } from './guards/delivery-admin-role.guard';
import { DeliveryGuidePageComponent } from './components/delivery-guide-page/delivery-guide-page.component';

const routes: Routes = [
  {
    path: '',
    component: DeliveryLayoutComponent,
    children: [
      { path: '', component: DeliveryHomeComponent, pathMatch: 'full' },
      { path: 'home', component: DeliveryHomeComponent },
      { path: 'create', component: DeliveryCreateComponent },
      { path: 'create-with-transporter', component: DeliveryCreateComponent },
      { path: 'guide', component: DeliveryGuidePageComponent },
      { path: 'tracking', component: DeliveryTrackingComponent },
      { path: 'active/:id/route', component: DeliveryActiveRouteComponent },
      { path: 'active', component: DeliveryActiveComponent },
      { path: 'calendar', component: TransporterCalendarPageComponent },
      { path: 'transporter-calendar', redirectTo: 'calendar', pathMatch: 'full' },
      { path: 'stats', component: TransporterStatsPageComponent },
      { path: 'groups-management', redirectTo: 'groups', pathMatch: 'full' },
      { path: 'demandes', component: DeliveryDemandesComponent },
      { path: 'dashboard', component: DeliveryDashboardComponent },
      { path: 'groups', component: GroupsManagementPageComponent },
      { path: 'admin', component: DeliveryAdminOverviewComponent, canActivate: [DeliveryAdminRoleGuard] },
      { path: 'history', component: DeliveryHistoryComponent },
      // Order matters: put "new" before ":id"
      { path: 'livraisons/new', component: DeliveryAdminFormComponent, canActivate: [DeliveryAdminRoleGuard], data: { mode: 'create' } },
      { path: 'livraisons/:id/edit', component: DeliveryAdminFormComponent, canActivate: [DeliveryAdminRoleGuard], data: { mode: 'edit' } },
      { path: 'livraisons/:id', component: DeliveryLivraisonDetailComponent },
      { path: '**', redirectTo: '' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DeliveryRoutingModule { }
