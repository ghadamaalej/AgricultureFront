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
import { FarmerShopComponent }           from './farmer/farmer-shop/farmer-shop.component';

// Vet
import { VetDashboardComponent }         from './vet/dashboard/vet-dashboard.component';
import { HealthRecordsComponent }        from './vet/health-records/health-records.component';
import { AvailabilityManagerComponent }  from './vet/availability-manager/availability-manager.component';
import { VetProfileFormComponent }       from './vet/profile-form/vet-profile-form.component';
import { ChatComponent }                 from './chat/chat.component';
import { AnimalDiagnosticComponent }     from './farmer/animal-diagnostic/animal-diagnostic.component';
import { VetAiChatbotComponent }         from './farmer/vet-ai-chatbot/vet-ai-chatbot.component';
import { FarmerImageChatbotComponent }   from './farmer/farmer-image-chatbot/farmer-image-chatbot.component';
import { FarmerPoultryChatbotComponent } from './farmer/farmer-poultry-chatbot/farmer-poultry-chatbot.component';
import { VetImageChatbotComponent }      from './vet/vet-image-chatbot/vet-image-chatbot.component';
import { VetPoultryChatbotComponent }    from './vet/vet-poultry-chatbot/vet-poultry-chatbot.component';
import { FarmerAvisComponent }           from './farmer/farmer-avis/farmer-avis.component';
import { VetAvisComponent }              from './vet/vet-avis/vet-avis.component';

import { InventoryModule }               from '../inventory/inventory.module';
import { ShopModule }                    from '../shop/shop.module';
import { VetCommandesComponent } from './vet/vet-commandes/vet-commandes.component';
import { VetStatisticsComponent } from './vet/vet-statistics/vet-statistics.component';
import { FarmerProfileFormComponent } from './farmer/farmer-profile-form/farmer-profile-form.component';

@NgModule({
  declarations: [
    AppointmentsLayoutComponent,
    VetListComponent,
    VetProfileComponent,
    MyAppointmentsComponent,
    FarmerShopComponent,
    VetDashboardComponent,
    AvailabilityManagerComponent,
    VetProfileFormComponent,
    HealthRecordsComponent,
    ChatComponent,
    AnimalDiagnosticComponent,
    VetAiChatbotComponent,
    FarmerImageChatbotComponent,
    FarmerPoultryChatbotComponent,
    VetImageChatbotComponent,
    VetPoultryChatbotComponent,
    FarmerAvisComponent,
    VetAvisComponent,
     VetCommandesComponent,
       VetStatisticsComponent,
       
    FarmerProfileFormComponent  

    
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppointmentsRoutingModule,
    InventoryModule,
    ShopModule,
  ]
})
export class AppointmentsModule {}
