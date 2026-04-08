import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormationListComponent } from './formation-list/formation-list.component';
import { FormationDetailComponent } from './formation-detail/formation-detail.component';
import { FormationFormComponent } from './formation-form/formation-form.component';

const routes: Routes = [
  { path: '', component: FormationListComponent },
  { path: 'add', component: FormationFormComponent },
  { path: ':id', component: FormationDetailComponent },
  { path: ':id/edit', component: FormationFormComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TrainingRoutingModule { }
