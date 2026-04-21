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
import { RoleHomePlaceholderComponent } from './components/role-home-placeholder/role-home-placeholder.component';
import { ExplorerHostComponent } from './components/explorer-host/explorer-host.component';

const routes: Routes = [
  { path: '',         component: HomeComponent,       pathMatch: 'full' },
  { path: 'explorer', component: ExplorerHostComponent },
  { path: 'auth',     component: AuthComponent, canActivate: [GuestGuard] },
  {
    path: 'forums',
    loadChildren: () => import('./forums/forums.module').then(m => m.ForumsModule)
  },
  {
    path: 'delivery',
    loadChildren: () => import('./delivery/delivery.module').then(m => m.DeliveryModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'dashboard',
    loadChildren: () =>import('./dashboard/dashboard.module').then(m => m.DashboardModule),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] }
  },
  // TODO: Replace each role-home placeholder route with its dedicated module/page when implemented.
  { path: 'buyer/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['ACHETEUR'], homeLabel: 'buyer home' } },
  { path: 'farmer/home', redirectTo: '/delivery', pathMatch: 'full' },
  { path: 'expert/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['EXPERT_AGRICOLE'], homeLabel: 'agricultural expert home' } },
  { path: 'transporter/home', redirectTo: '/delivery', pathMatch: 'full' },
  { path: 'veterinarian/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['VETERINAIRE'], homeLabel: 'veterinarian home' } },
  { path: 'agent/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['AGENT'], homeLabel: 'agent home' } },
  { path: 'organizer/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['ORGANISATEUR_EVENEMENT'], homeLabel: 'event organizer home' } },
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