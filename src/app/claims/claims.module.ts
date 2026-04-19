import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { ClaimsRoutingModule }    from './claims-routing.module';
import { ClaimsLayoutComponent }  from './layout/claims-layout.component';
import { MyClaimsComponent }      from './user/my-claims/my-claims.component';
import { NewClaimComponent }      from './user/new-claim/new-claim.component';
import { ClaimDetailComponent }   from './user/claim-detail/claim-detail.component';

// NOTE: AdminClaimsComponent is declared in ClaimsAdminModule (lazy-loaded in dashboard)
// ClaimDetailComponent is shared: it adapts based on isAdmin flag in its TS.
// To avoid "declared in 2 modules" error, ClaimDetailComponent is declared HERE only.
// ClaimsAdminModule imports ClaimsModule to access ClaimDetailComponent via exports.

@NgModule({
  declarations: [
    ClaimsLayoutComponent,
    MyClaimsComponent,
    NewClaimComponent,
    ClaimDetailComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    ClaimsRoutingModule,
  ],
  exports: [
    ClaimDetailComponent  // shared with ClaimsAdminModule
  ]
})
export class ClaimsModule {}
