import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ForumsRoutingModule } from './forums-routing.module';
import { ForumsHomeComponent } from './components/forums-home/forums-home.component';
import { ForumsPostComponent } from './components/forums-post/forums-post.component';


@NgModule({
  declarations: [
    ForumsHomeComponent,
    ForumsPostComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ForumsRoutingModule
  ]
})
export class ForumsModule { }
