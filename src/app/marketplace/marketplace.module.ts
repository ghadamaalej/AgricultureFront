import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { FooterComponent } from '../components/footer/footer.component';
import { MarketplaceRoutingModule } from './marketplace-routing.module';
import { MarketplaceComponent } from './pages/marketplace/marketplace.component';
import { AppModule } from '../app.module';
  import { SharedModule } from '../shared/shared.module';
  import { FormsModule } from '@angular/forms';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { MyVisitReservationsComponent } from './pages/my-visit-reservations/my-visit-reservations.component';
import { ManageReservationsComponent } from './pages/manage-reservations/manage-reservations.component';
@NgModule({
  declarations: [
    MarketplaceComponent,
    ProductDetailComponent,
    MyVisitReservationsComponent,
    ManageReservationsComponent
  ],
  imports: [
    CommonModule,
    MarketplaceRoutingModule,
    FormsModule,
    SharedModule
  ]
})
export class MarketplaceModule { }
