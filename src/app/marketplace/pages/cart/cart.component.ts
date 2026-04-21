import { ViewChild, ElementRef, AfterViewInit, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CartService } from '../../../services/cart/cart.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})

export class CartComponent implements OnInit, AfterViewInit {

  @ViewChild('carousel') carousel?: ElementRef;

  currentUserId: number | null = null;
  cart: any = null;
  cartItems: any[] = [];
  loading = false;

  showPopup = false;
  popupTitle = '';
  popupMessage = '';
  popupType: 'success' | 'error' = 'success';
  recommendations: any[] = [];

  showDeliveryButton = false;

  tipAmount: number = 0;
  showTipThanks: boolean = false;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private route: ActivatedRoute
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

    this.route.queryParams.subscribe(params => {
      const paymentStatus = params['payment'];

      if (paymentStatus === 'success') {
        this.showDeliveryButton = true;
        this.openPopup(
          'Thank You!',
          'Your payment was completed successfully. Thank you for your order! If you would like, you can also use our delivery service.',
          'success'
        );
      } else if (paymentStatus === 'cancel') {
        this.showDeliveryButton = false;
        this.openPopup(
          'Payment Cancelled',
          'Your payment was cancelled. Your order is still pending for a limited time.',
          'error'
        );
      }
    });

    this.loadCart();
    this.cartService.refreshCartCount();
  }

  useDeliveryService(): void {
    this.openPopup(
      'Delivery Service',
      'Delivery service integration will be added soon.',
      'success'
    );
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
        this.loadRecommendations();
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

  this.loading = true;
  console.log('STEP 1: starting checkout');

  this.cartService.checkout(this.currentUserId, this.tipAmount).subscribe({
    next: (commande: any) => {
      console.log('STEP 2: checkout created', commande);

      const commandeId = Number(commande?.idCommande ?? commande?.id);

      if (!commandeId) {
        this.loading = false;
        this.openPopup('Payment Error', 'Commande ID not found after checkout.', 'error');
        return;
      }

      const payload = {
        commandeId: commandeId,
        userId: this.currentUserId!,
        montant: Number(commande?.montantTotal ?? this.totalToPay),
        productName: `Commande GreenRoots #${commandeId}`
      };

      console.log('STEP 3: stripe payload', payload);

      this.cartService.createStripeCheckoutSession(payload).subscribe({
        next: (stripeRes: any) => {
          console.log('STEP 4: stripe response', stripeRes);

          if (stripeRes?.checkoutUrl) {
            console.log('STEP 5: redirecting to', stripeRes.checkoutUrl);
            window.location.href = stripeRes.checkoutUrl;
            return;
          }

          this.loading = false;
          this.openPopup('Payment Error', 'Stripe checkout URL not received.', 'error');
        },
        error: (err: any) => {
          console.error('STEP 4 ERROR: Stripe session failed', err);
          this.loading = false;
          this.openPopup('Payment Error', 'Failed to start Stripe payment.', 'error');
        }
      });
    },
    error: (err: any) => {
      console.error('STEP 2 ERROR: Checkout failed', err);
      this.loading = false;
      this.openPopup('Checkout Error', 'Failed to checkout.', 'error');
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

  loadRecommendations(): void {
    if (!this.currentUserId) return;

    this.cartService.getRecommendations(this.currentUserId).subscribe({
      next: (res: any[]) => {
        this.recommendations = res.map(p => ({
          ...p,
          imageUrl: p.photoProduit
            ? 'http://localhost:8090/uploads/' + p.photoProduit
            : 'assets/images/product1.jpg'
        }));
      },
      error: (err) => {
        console.error('AI recommendation failed', err);
        this.recommendations = [];
      }
    });
  }

  addToCart(product: any): void {
  if (!this.currentUserId) return;

  this.cartService.addToCart(this.currentUserId, product.id, 1)
    .subscribe(() => {
      this.loadCart();
      this.cartService.refreshCartCount();
    });
}

scrollLeft() {
  if (!this.carousel) return;

  this.carousel.nativeElement.scrollBy({
    left: -300,
    behavior: 'smooth'
  });
}

scrollRight() {
  if (!this.carousel) return;

  this.carousel.nativeElement.scrollBy({
    left: 300,
    behavior: 'smooth'
  });
}
ngAfterViewInit(): void {
  setTimeout(() => {
    setInterval(() => {
      this.scrollRight();
    }, 4000);
  }, 500); // wait for DOM
}

get subtotal(): number {
  return Number(this.cart?.montantEstime || 0);
}

get commissionAmount(): number {
  return this.subtotal * 0.20;
}

get totalToPay(): number {
  return this.subtotal + this.commissionAmount + Number(this.tipAmount || 0);
}

addTip(amount: number): void {
  this.tipAmount = amount;
  this.showTipThanks = amount > 0;
}

removeTip(): void {
  this.tipAmount = 0;
  this.showTipThanks = false;
}
}