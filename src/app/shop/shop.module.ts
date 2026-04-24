import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { GlobalShopComponent }    from './components/global-shop/global-shop.component';
import { CartDrawerComponent }    from './components/cart-drawer/cart-drawer.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';
import { CheckoutComponent }      from './components/checkout/checkout.component';
import { CartIconComponent }      from './components/cart-icon/cart-icon.component';
import { CartConflictComponent }  from './components/cart-conflict/cart-conflict.component';

@NgModule({
  declarations: [
    GlobalShopComponent,
    CartDrawerComponent,
    ProductDetailComponent,
    CheckoutComponent,
    CartIconComponent,
    CartConflictComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  exports: [
    GlobalShopComponent,
    CartDrawerComponent,
    ProductDetailComponent,
    CheckoutComponent,
    CartIconComponent,
    CartConflictComponent,
  ]
})
export class ShopModule {}
