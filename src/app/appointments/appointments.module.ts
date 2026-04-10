import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppointmentsRoutingModule } from './appointments-routing.module';

// Layout
import { AppointmentsLayoutComponent }   from './layout/appointments-layout.component';

// Farmer
import { VetListComponent }              from './farmer/vet-list/vet-list.component';
import { VetProfileComponent }           from './farmer/vet-profile/vet-profile.component';
import { MyAppointmentsComponent }       from './farmer/my-appointments/my-appointments.component';

// Vet
import { VetDashboardComponent }         from './vet/dashboard/vet-dashboard.component';
import { HealthRecordsComponent }        from './vet/health-records/health-records.component';
import { AvailabilityManagerComponent }  from './vet/availability-manager/availability-manager.component';
import { VetProfileFormComponent }       from './vet/profile-form/vet-profile-form.component';
import { ChatComponent }                 from './chat/chat.component';

@NgModule({
  declarations: [
    AppointmentsLayoutComponent,
    VetListComponent,
    VetProfileComponent,
    MyAppointmentsComponent,
    VetDashboardComponent,
    AvailabilityManagerComponent,
    VetProfileFormComponent,
    HealthRecordsComponent,
    ChatComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppointmentsRoutingModule,
  ]
})
export class AppointmentsModule {}
