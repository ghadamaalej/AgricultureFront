import { Component, OnInit } from '@angular/core';
import { CartService } from '../../../services/cart/cart.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit {

  currentUserId: number | null = null;
  cart: any = null;
  cartItems: any[] = [];
  loading = false;

  showPopup = false;
  popupTitle = '';
  popupMessage = '';
  popupType: 'success' | 'error' = 'success';

  constructor(
    private cartService: CartService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first to view your cart.', 'error');
      this.cartItems = [];
      this.cart = null;
      this.cartService.refreshCartCount();
      return;
    }

    this.loadCart();
    this.cartService.refreshCartCount();
  }

  loadCart(): void {
    if (!this.currentUserId) {
      this.loading = false;
      this.cartItems = [];
      this.cart = null;
      return;
    }

    this.loading = true;

    this.cartService.getCartDetails(this.currentUserId).subscribe({
      next: (data: any) => {
        this.cart = data;
        this.cartItems = (data.items || []).map((item: any) => ({
          ...item,
          imageUrl: item.image
            ? 'http://localhost:8090/uploads/' + item.image
            : 'assets/images/product1.jpg'
        }));
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Failed to load cart', err);
        this.loading = false;
        this.openPopup('Cart Error', typeof err === 'string' ? err : 'Failed to load cart.', 'error');
      }
    });
  }

  increase(item: any): void {
    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    if (item.quantite < (item.stockDisponible || 0)) {
      const newQty = item.quantite + 1;

      this.cartService.updateQuantity(this.currentUserId, item.produitId, newQty)
        .subscribe({
          next: () => {
            this.loadCart();
            this.cartService.refreshCartCount();
          },
          error: (err: any) => {
            this.openPopup('Update Error', typeof err === 'string' ? err : 'Failed to update quantity.', 'error');
          }
        });
    }
  }

  decrease(item: any): void {
    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    if (item.quantite > 1) {
      const newQty = item.quantite - 1;

      this.cartService.updateQuantity(this.currentUserId, item.produitId, newQty)
        .subscribe({
          next: () => {
            this.loadCart();
            this.cartService.refreshCartCount();
          },
          error: (err: any) => {
            this.openPopup('Update Error', typeof err === 'string' ? err : 'Failed to update quantity.', 'error');
          }
        });
    }
  }

  remove(item: any): void {
    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    this.cartService.removeFromCart(this.currentUserId, item.produitId)
      .subscribe({
        next: () => {
          this.loadCart();
          this.cartService.refreshCartCount();
          this.openPopup('Removed', `${item.nom} removed from cart.`, 'success');
        },
        error: (err: any) => {
          this.openPopup('Remove Error', typeof err === 'string' ? err : 'Failed to remove product.', 'error');
        }
      });
  }

  checkout(): void {
    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first to checkout.', 'error');
      return;
    }

    if (!this.cartItems.length) {
      this.openPopup('Checkout Error', 'Your cart is empty.', 'error');
      return;
    }

    this.cartService.checkout(this.currentUserId).subscribe({
      next: (res: any) => {
        console.log('Checkout success:', res);

        this.openPopup(
          'Order Created',
          'Commande créée avec statut EN_COURS. Elle sera annulée automatiquement après 2 minutes si aucun paiement n’est validé.',
          'success'
        );

        this.loadCart();
        this.cartService.refreshCartCount();
      },
      error: (err: any) => {
        console.error('Checkout failed:', err);
        this.openPopup(
          'Checkout Error',
          typeof err === 'string' ? err : 'Failed to checkout.',
          'error'
        );
      }
    });
  }

  openPopup(title: string, message: string, type: 'success' | 'error' = 'success'): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;
  }

  closePopup(): void {
    this.showPopup = false;
  }
}