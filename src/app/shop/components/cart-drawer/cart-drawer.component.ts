import { Component, Output, EventEmitter } from '@angular/core';
import { CartService, CartItem } from '../../services/cart.service';

@Component({
  selector: 'app-cart-drawer',
  standalone: false,
  templateUrl: './cart-drawer.component.html',
  styleUrls: ['./cart-drawer.component.css']
})
export class CartDrawerComponent {
  @Output() close      = new EventEmitter<void>();
  @Output() checkout   = new EventEmitter<void>();

  constructor(public cartService: CartService) {}

  updateQty(item: CartItem, delta: number) {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      this.cartService.removeItem(item.product.id);
    } else {
      const max = item.product.currentQuantity ?? 999;
      this.cartService.updateQuantity(item.product.id, Math.min(newQty, max));
    }
  }

  remove(item: CartItem) {
    this.cartService.removeItem(item.product.id);
  }

  clearCart() {
    if (confirm('Vider le panier ?')) this.cartService.clear();
  }

  imageUrl(item: CartItem): string {
    return item.product.imageUrl ? 'http://localhost:8088' + item.product.imageUrl : '';
  }

  categoryEmoji(c: string): string {
    return { VACCIN:'💉', MEDICAMENT:'💊', ALIMENT:'🌾', RECOLTE:'🌿', AUTRE:'📦' }[c] || '📦';
  }
}
