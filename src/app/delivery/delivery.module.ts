import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { DeliveryRoutingModule } from './delivery-routing.module';

import { DeliveryLayoutComponent } from './components/layout/delivery-layout.component';
import { DeliveryHomeComponent } from './components/home/delivery-home.component';
import { DeliveryCreateComponent } from './components/create/delivery-create.component';
import { DeliveryTrackingComponent } from './components/tracking/delivery-tracking.component';
import { DeliveryDemandesComponent } from './components/demandes/delivery-demandes.component';
import { DeliveryDashboardComponent } from './components/dashboard/delivery-dashboard.component';
import { DeliveryGroupsComponent } from './components/groups/delivery-groups.component';
import { DeliveryLivraisonsListComponent } from './components/livraisons/delivery-livraisons-list.component';
import { DeliveryLivraisonDetailComponent } from './components/livraisons/delivery-livraison-detail.component';
import { DeliveryAdminFormComponent } from './components/admin/delivery-admin-form.component';
import { DeliveryAdminOverviewComponent } from './components/admin/delivery-admin-overview.component';
import { DeliveryActiveComponent } from './components/active/delivery-active.component';
import { DeliveryActiveRouteComponent } from './components/active-route/delivery-active-route.component';
import { DeliveryCalendarComponent } from './components/calendar/delivery-calendar.component';
import { DeliveryHistoryComponent } from './components/history/delivery-history.component';
import { DeliveryRequestService } from './services/delivery-request.service';
import { DeliveryExtendedService } from './services/delivery-extended.service';

// Nouveaux composants
import { NegotiationComponent } from './components/negotiation/negotiation.component';
import { TransporterCalendarComponent } from './components/transporter-calendar/transporter-calendar.component';
import { TransporterStatsComponent } from './components/transporter-stats/transporter-stats.component';
import { GroupsManagementComponent } from './components/groups-management/groups-management.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { TransporterCalendarPageComponent } from './components/transporter-calendar-page/transporter-calendar-page.component';
import { TransporterStatsPageComponent } from './components/transporter-stats-page/transporter-stats-page.component';
import { GroupsManagementPageComponent } from './components/groups-management-page/groups-management-page.component';
import { DeliveryWithNegotiationComponent } from './components/delivery-with-negotiation/delivery-with-negotiation.component';
import { DeliveryGuidePageComponent } from './components/delivery-guide-page/delivery-guide-page.component';
import { DeliverySignatureComponent } from './components/delivery-signature/delivery-signature.component';
import { DeliveryReceiptComponent } from './components/delivery-receipt/delivery-receipt.component';


@NgModule({
  declarations: [
    DeliveryLayoutComponent,
    DeliveryHomeComponent,
    DeliveryCreateComponent,
    DeliveryTrackingComponent,
    DeliveryDemandesComponent,
    DeliveryDashboardComponent,
    DeliveryGroupsComponent,
    DeliveryLivraisonsListComponent,
    DeliveryLivraisonDetailComponent,
    DeliveryAdminFormComponent,
    DeliveryAdminOverviewComponent,
    DeliveryActiveComponent,
    DeliveryActiveRouteComponent,
    DeliveryCalendarComponent,
    DeliveryHistoryComponent,
    // Nouveaux composants
    NegotiationComponent,
    TransporterCalendarComponent,
    TransporterStatsComponent,
    GroupsManagementComponent,
    NotificationsComponent,
    TransporterCalendarPageComponent,
    TransporterStatsPageComponent,
    GroupsManagementPageComponent,
    DeliveryWithNegotiationComponent,
    DeliveryGuidePageComponent,
    DeliverySignatureComponent,
    DeliveryReceiptComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    DeliveryRoutingModule
  ],
  providers: [DeliveryRequestService, DeliveryExtendedService]
})
export class DeliveryModule { }