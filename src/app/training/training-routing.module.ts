import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormationListComponent } from './formation-list/formation-list.component';

const routes: Routes = [
  { path: '', component: FormationListComponent },
  { path: 'add', loadComponent: () => import('./formation-form/formation-form.component').then(m => m.FormationFormComponent) },
  { path: ':id', loadComponent: () => import('./formation-detail/formation-detail.component').then(m => m.FormationDetailComponent) },
  { path: ':id/edit', loadComponent: () => import('./formation-form/formation-form.component').then(m => m.FormationFormComponent) }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TrainingRoutingModule { }
