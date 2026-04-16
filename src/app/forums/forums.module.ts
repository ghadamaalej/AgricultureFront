import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ForumsRoutingModule } from './forums-routing.module';
import { ForumsHomeComponent } from './components/forums-home/forums-home.component';
import { ForumsPostComponent } from './components/forums-post/forums-post.component';
import { ForumsUserProfileComponent } from './components/forums-user-profile/forums-user-profile.component';
import { BadgeComponent } from './components/badge/badge.component';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    ForumsHomeComponent,
    ForumsPostComponent,
    ForumsUserProfileComponent,
    BadgeComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ForumsRoutingModule
  ]
})
export class ForumsModule { }
