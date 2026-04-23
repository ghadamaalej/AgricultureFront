import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent }       from './components/home/home.component';
import { BlogDetailComponent } from './components/blog-detail/blog-detail.component';
import { NotFoundComponent }   from './components/not-found/not-found.component';
import { AuthComponent }       from './components/auth/auth.component';
import { AuthGuard }           from './services/auth/auth.guard';
import { GuestGuard }          from './services/auth/guest.guard';
import { RegisterExtraComponent }            from './components/register-extra/register-extra.component';
import { RoleHomePlaceholderComponent }      from './components/role-home-placeholder/role-home-placeholder.component';
import { ExplorerHostComponent }             from './components/explorer-host/explorer-host.component';
import { DiseasePredictorComponent }         from './components/disease-predictor/disease-predictor.component';
import { HelpRequestComponent }              from './components/help-request/help-request.component';
import { ExpertAssistanceRequestsComponent } from './components/expert-assistance-requests/expert-assistance-requests.component';

const routes: Routes = [
  { path: '',         component: HomeComponent,  pathMatch: 'full' },
  { path: 'explorer', component: ExplorerHostComponent },
  { path: 'auth',     component: AuthComponent,  canActivate: [GuestGuard] },

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
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule),
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'marketplace',
    loadChildren: () => import('./marketplace/marketplace.module').then(m => m.MarketplaceModule)
  },
  {
    path: 'loans',
    loadChildren: () => import('./loans/loans.module').then(m => m.LoansModule),
    canActivate: [AuthGuard],
    data: { roles: ['AGENT', 'AGRICULTEUR'] }   // ← merged from second file
  },
  {
    path: 'claims',
    loadChildren: () => import('./claims/claims.module').then(m => m.ClaimsModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'events',
    loadChildren: () => import('./events/events.module').then(m => m.EventsModule)
  },
  {
    path: 'formations',
    loadChildren: () => import('./training/training.module').then(m => m.TrainingModule)
  },
  {
    path: 'farm',
    loadChildren: () => import('./features/farm/farm.module').then(m => m.FarmModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'inventory',
    loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'appointments',
    loadChildren: () => import('./appointments/appointments.module').then(m => m.AppointmentsModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'animals',
    loadChildren: () => import('./animals/animals.module').then(m => m.AnimalsModule),
    canActivate: [AuthGuard]
  },

  // Standalone page components declared in AppModule
  { path: 'disease-predictor',          component: DiseasePredictorComponent,         canActivate: [AuthGuard] },
  { path: 'help-request',               component: HelpRequestComponent,               canActivate: [AuthGuard] },
  { path: 'expert/assistance-requests', component: ExpertAssistanceRequestsComponent,  canActivate: [AuthGuard] },

  // Role-home placeholders
  { path: 'buyer/home',        component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['ACHETEUR'],               homeLabel: 'buyer home'               } },
  { path: 'farmer/home',       component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['AGRICULTEUR'],            homeLabel: 'farmer home'              } },
  { path: 'expert/home',       component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['EXPERT_AGRICOLE'],        homeLabel: 'agricultural expert home' } },
  { path: 'transporter/home',  component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['TRANSPORTEUR'],           homeLabel: 'transporter home'         } },
  { path: 'veterinarian/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['VETERINAIRE'],            homeLabel: 'veterinarian home'        } },
  { path: 'agent/home',        component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['AGENT'],                  homeLabel: 'agent home'               } },
  { path: 'organizer/home',    component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['ORGANISATEUR_EVENEMENT'], homeLabel: 'event organizer home'     } },

  { path: 'register-extra', component: RegisterExtraComponent },
  { path: 'blog/:id',       component: BlogDetailComponent    },
  { path: '404',            component: NotFoundComponent      },
  { path: '**',             redirectTo: '/404'                }
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