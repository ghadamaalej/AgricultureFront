import { Component } from '@angular/core';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart-icon',
  standalone: false,
  template: `
    <button class="cart-icon-btn" (click)="toggle()">
      <i class="fas fa-shopping-cart"></i>
      <span class="cart-badge" *ngIf="cartService.count > 0">{{ cartService.count }}</span>
    </button>
  `,
  styles: [`
    .cart-icon-btn {
      position: relative; background: #2e7d32; color: #fff; border: none;
      border-radius: 50%; width: 48px; height: 48px; font-size: 18px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(46,125,50,.4); transition: all .2s;
    }
    .cart-icon-btn:hover { background: #1b5e20; transform: scale(1.05); }
    .cart-badge {
      position: absolute; top: -4px; right: -4px;
      background: #f44336; color: #fff; border-radius: 50%;
      width: 20px; height: 20px; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff;
    }
  `]
})
export class CartIconComponent {
  showCart = false;
  constructor(public cartService: CartService) {}
  toggle() { this.showCart = !this.showCart; }
}
