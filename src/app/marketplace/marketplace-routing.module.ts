import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MarketplaceComponent } from './pages/marketplace/marketplace.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { MyVisitReservationsComponent } from './pages/my-visit-reservations/my-visit-reservations.component';
import { ManageReservationsComponent } from './pages/manage-reservations/manage-reservations.component';
import { CartComponent } from './pages/cart/cart.component';
const routes: Routes = [
  { path: '', component: MarketplaceComponent },
  { path: 'my-visit-reservations', component: MyVisitReservationsComponent },
  { path: 'manage-reservations', component: ManageReservationsComponent },
  { path: 'cart', component: CartComponent },
  { path: ':mode/:id', component: ProductDetailComponent }
  //{ path: 'marketplace/product/:id', component: ProductDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MarketplaceRoutingModule { }
