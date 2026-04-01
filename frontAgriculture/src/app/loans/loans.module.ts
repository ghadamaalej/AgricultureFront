import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoansRoutingModule } from './loans-routing.module';
import { SharedModule } from '../shared/shared.module';
import { ServicesListComponent } from './agent/services-list/services-list.component';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import {InstitutionsListComponent} from'../loans/agriculteur/institutions-list/institutions-list.component'
import { DemandePretFormComponent } from './agriculteur/demande-pret-form/demande-pret-form.component';
import { ApplicationsListComponent } from './agent/applications-list/applications-list.component';
@NgModule({
  declarations: [
    ServicesListComponent,
    InstitutionsListComponent,
    DemandePretFormComponent ,
    ApplicationsListComponent   

   
  ],
  imports: [
    SharedModule,
    CommonModule,
    LoansRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    
        
  ]
})
export class LoansModule { }
