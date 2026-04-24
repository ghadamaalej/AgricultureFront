import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MarketplaceRoutingModule } from './marketplace-routing.module';
import { SharedModule } from '../shared/shared.module';

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

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RecipeChatbotComponent } from './components/recipe-chatbot/recipe-chatbot.component';
import { RentalPaymentComponent } from './pages/rental-payment/rental-payment.component';
@NgModule({
  declarations: [
    MarketplaceComponent,
    ProductDetailComponent,
    MyVisitReservationsComponent,
    ManageReservationsComponent,
    CartComponent,
    ManageRentalProposalsComponent,
    MyRentalProposalsComponent,
    RentalContractComponent,
    OrderHistoryComponent,
    OrderDetailComponent,
    RecipeChatbotComponent,
    RentalPaymentComponent
  ],
  imports: [
    CommonModule,
    MarketplaceRoutingModule,
    FormsModule,
    SharedModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule
  ]
})
export class MarketplaceModule {}