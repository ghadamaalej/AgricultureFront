import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EventsRoutingModule } from './events-routing.module';
import { ListComponent } from './list-events/list-events.component';
import { SharedModule } from '../shared/shared.module';
import { DetailsEventComponent } from './details-event/details-event.component';
import { OrganisateurEventListComponent } from './organisateur-event-list/organisateur-event-list.component';
import { ReactiveFormsModule } from '@angular/forms';
import { OrganisateurEventFormComponent } from './organisateur-event-form/organisateur-event-form.component';
import { PaymentComponent } from './payment/payment/payment.component';
import { EventMapComponent } from './event-map/event-map.component';


@NgModule({
  declarations: 
  [
    ListComponent,
    DetailsEventComponent,
    OrganisateurEventListComponent,
    OrganisateurEventFormComponent,
    PaymentComponent,
    EventMapComponent,
  ],
  imports: [
    CommonModule,
    EventsRoutingModule,
     ReactiveFormsModule,
    SharedModule
  ]
})
export class EventsModule { }
