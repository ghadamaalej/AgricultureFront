import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MarketplaceComponent } from './pages/marketplace/marketplace.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { MyVisitReservationsComponent } from './pages/my-visit-reservations/my-visit-reservations.component';
import { ManageReservationsComponent } from './pages/manage-reservations/manage-reservations.component';
import { CartComponent } from './pages/cart/cart.component';
import { ManageRentalProposalsComponent } from './pages/manage-rental-proposals/manage-rental-proposals.component';
import { MyRentalProposalsComponent } from './pages/my-rental-proposals/my-rental-proposals.component';
import { RentalContractComponent } from './pages/rental-contract/rental-contract.component';
import { OrderHistoryComponent } from './pages/order-history/order-history.component';
import { OrderDetailComponent } from './pages/order-detail/order-detail.component';
import { RentalPaymentComponent } from './pages/rental-payment/rental-payment.component';

const routes: Routes = [
  { path: '', component: MarketplaceComponent },
  { path: 'my-visit-reservations', component: MyVisitReservationsComponent },
  { path: 'manage-reservations', component: ManageReservationsComponent },
  { path: 'cart', component: CartComponent },
  { path: 'manage-rental-proposals', component: ManageRentalProposalsComponent },
  { path: 'my-rental-proposals', component: MyRentalProposalsComponent },
  { path: 'rental-contract/:id', component: RentalContractComponent },
  { path: 'orders', component: OrderHistoryComponent },
  { path: 'orders/:id', component: OrderDetailComponent },
  { path: 'rental-payment/:proposalId', component: RentalPaymentComponent },
  { path: ':mode/:id', component: ProductDetailComponent }
  //{ path: 'marketplace/product/:id', component: ProductDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MarketplaceRoutingModule { }
