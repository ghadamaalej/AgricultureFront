import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent }       from './components/home/home.component';
import { BlogDetailComponent } from './components/blog-detail/blog-detail.component';
import { NotFoundComponent }   from './components/not-found/not-found.component';
import { AuthComponent }       from './components/auth/auth.component';
import { AuthGuard }           from './services/auth/auth.guard';
import { GuestGuard }          from './services/auth/guest.guard';
import { RegisterExtraComponent } from './components/register-extra/register-extra.component';


const routes: Routes = [
  { path: '',         component: HomeComponent,       pathMatch: 'full' },
  { path: 'auth',     component: AuthComponent, canActivate: [GuestGuard] },
  {
    path: 'forums',
    loadChildren: () => import('./forums/forums.module').then(m => m.ForumsModule)
  },
   {
    path: 'appointments',
    loadChildren: () => import('./appointments/appointments.module').then(m => m.AppointmentsModule)
  },
   {
    path: 'inventory',
    loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryModule)
  },
 
{
  path: 'claims',
  loadChildren: () => import('./claims/claims.module').then(m => m.ClaimsModule)
},

   
  {
    path: 'dashboard', 
    loadChildren: () =>import('./dashboard/dashboard.module').then(m => m.DashboardModule),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] }
  },
  { path: 'marketplace/cart', redirectTo: 'appointments', pathMatch: 'full' },
  { path: 'register-extra',  component: RegisterExtraComponent  },
  { path: 'blog/:id', component: BlogDetailComponent },
  { path: '404',      component: NotFoundComponent   },
  { path: '**',       redirectTo: '/404'             }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forRoot(routes)
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }