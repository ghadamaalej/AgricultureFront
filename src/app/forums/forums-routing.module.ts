import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ForumsHomeComponent } from './components/forums-home/forums-home.component';
import { ForumsPostComponent } from './components/forums-post/forums-post.component';

const routes: Routes = [
  { path: '', component: ForumsHomeComponent },
  { path: 'post/:id', component: ForumsPostComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ForumsRoutingModule { }
