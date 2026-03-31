import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ServicesListComponent } from './agent/services-list/services-list.component';
import{ServiceFormComponent} from './agent/service-form/service-form.component';
import {InstitutionsListComponent} from './agriculteur/institutions-list/institutions-list.component';
import { DemandePretFormComponent } from './agriculteur/demande-pret-form/demande-pret-form.component';

const routes: Routes = [
{ path: 'agent/services', component: ServicesListComponent }, 
{ path: 'agent/services/new', component: ServiceFormComponent },
{ path: 'agent/services/edit/:id', component: ServiceFormComponent },
{ path: 'institutions', component: InstitutionsListComponent },
{path: 'application/:id',component: DemandePretFormComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LoansRoutingModule { }
