import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListComponent } from './list-events/list-events.component';
import { DetailsEventComponent } from './details-event/details-event.component';
import { OrganisateurEventListComponent } from './organisateur-event-list/organisateur-event-list.component';
import { OrganisateurEventFormComponent } from './organisateur-event-form/organisateur-event-form.component';
import { PaymentComponent } from './payment/payment/payment.component';
import { EventMapComponent } from './event-map/event-map.component';

const routes: Routes = [
  { path: '', redirectTo: 'listEvents', pathMatch: 'full' },
  { path: 'listEvents', component: ListComponent },
  { path: 'detailsEvent/:id', component: DetailsEventComponent },
  { path: 'organizer/events', component: OrganisateurEventListComponent },
  { path: 'organizer/events/add',    component: OrganisateurEventFormComponent },
  { path: 'organizer/events/edit/:id', component: OrganisateurEventFormComponent },
  { path: 'payment/:reservationId', component: PaymentComponent },
  { path: 'map', component: EventMapComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EventsRoutingModule { }
