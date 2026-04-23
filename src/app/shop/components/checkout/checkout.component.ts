import { Component, OnInit, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { PaymentApiService, CommandeRequest } from '../../services/payment-api.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { AuthService } from 'src/app/services/auth/auth.service';

declare var Stripe: any;

@Component({
  selector: 'app-checkout',
  standalone: false,
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  @Output() close   = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  step: 'summary' | 'payment' | 'processing' | 'success' | 'error' = 'summary';
  error = '';
  orderId: number | null = null;
  orderRef = '';

  stripe: any = null;
  elements: any = null;
  paymentElement: any = null;
  clientSecret = '';

  constructor(
    public cartService: CartService,
    private paymentApi: PaymentApiService,
    private toast: ToastService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.loadStripe();
  }

  ngOnDestroy() {
    if (this.paymentElement) this.paymentElement.destroy();
  }

  loadStripe() {
    if (typeof Stripe === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => { this.stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY'); };
      document.head.appendChild(script);
    } else {
      this.stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY');
    }
  }

  proceedToPayment() {
    const userId = this.auth.getCurrentUserId();
    if (!userId) { this.toast.error('Vous devez être connecté.'); return; }

    const request: CommandeRequest = {
      agriculteurId: userId,
      items: this.cartService.items.map(i => ({
        productId: i.product.id,
        vetId: i.product.owner?.id ?? 0,
        nomProduit: i.product.nom,
        vetNom: i.vetNom,
        vetRegion: i.vetRegion,
        prixUnitaire: i.product.prixVente ?? 0,
        quantite: i.quantity,
        sousTotal: i.sousTotal
      }))
    };

    this.step = 'processing';
    this.paymentApi.creerCommande(request).subscribe({
      next: (commande) => {
        this.orderId = commande.id;
        this.clientSecret = commande.stripeClientSecret;
        this.orderRef = `CMD-${commande.id}`;
        this.step = 'payment';
        setTimeout(() => this.mountStripeElement(), 300);
      },
      error: (e) => {
        this.error = e.error?.message || 'Erreur lors de la création de la commande.';
        this.step = 'error';
        this.toast.error(this.error);
      }
    });
  }

  mountStripeElement() {
    if (!this.stripe || !this.clientSecret) return;

    this.elements = this.stripe.elements({ clientSecret: this.clientSecret, locale: 'fr' });
    this.paymentElement = this.elements.create('payment');
    this.paymentElement.mount('#stripe-payment-element');
  }

  async confirmPayment() {
    if (!this.stripe || !this.elements) return;
    this.step = 'processing';

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: window.location.href
      },
      redirect: 'if_required'
    });

    if (error) {
      this.error = error.message || 'Paiement échoué.';
      this.step = 'error';
      this.toast.error(this.error);
    } else {
      this.step = 'success';
      this.cartService.clear();
      this.toast.success('Paiement effectué avec succès !');
      setTimeout(() => this.success.emit(), 2000);
    }
  }

  retryPayment() {
    this.step = 'summary';
    this.error = '';
  }
}
