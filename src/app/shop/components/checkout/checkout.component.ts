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
  paymentElementReady = false;
  isConfirmingPayment = false;
  private readonly stripePublishableKey = 'pk_test_51TLlvW4WOLv4xB64Ky7TafIi9dKCCiIMQTAUEbIJVSvSm1hKGihxULANwuzAH0PHTVjHpwgqEVgTemv7hvhdq4Re00jXu8gGh1';

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
      script.onload = () => { this.stripe = Stripe(this.stripePublishableKey); };
      document.head.appendChild(script);
    } else {
      this.stripe = Stripe(this.stripePublishableKey);
    }
  }

  proceedToPayment() {
    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      this.toast.error('Vous devez etre connecte.');
      return;
    }

    const request: CommandeRequest = {
      agriculteurId: userId,
      items: this.cartService.items.map(i => ({
        productId: i.product.id,
        vetId: i.product.owner?.id ?? 0,
        nomProduit: i.product.nom,
        vetNom: i.vetNom,
        vetRegion: i.vetRegion,
        prixUnitaire: i.product.prixVente ?? 0,
        quantite: i.quantity
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
        this.error = e.error?.error || e.error?.message || 'Erreur lors de la creation de la commande.';
        this.step = 'error';
        this.toast.error(this.error);
      }
    });
  }

  mountStripeElement() {
    if (!this.stripe || !this.clientSecret) {
      this.error = 'Stripe non initialise. Verifiez la cle publique.';
      this.step = 'error';
      this.toast.error(this.error);
      return;
    }

    try {
      this.paymentElementReady = false;
      this.elements = this.stripe.elements({ clientSecret: this.clientSecret, locale: 'fr' });
      this.paymentElement = this.elements.create('payment');
      this.paymentElement.on('ready', () => { this.paymentElementReady = true; });
      this.paymentElement.on('loaderror', (event: any) => {
        this.paymentElementReady = false;
        this.error = event?.error?.message || 'Impossible de charger le formulaire de paiement.';
        this.step = 'error';
        this.toast.error(this.error);
      });
      this.paymentElement.mount('#stripe-payment-element');
    } catch (e: any) {
      this.error = e?.message || 'Erreur lors de l initialisation du paiement.';
      this.step = 'error';
      this.toast.error(this.error);
    }
  }

  async confirmPayment() {
    if (!this.stripe || !this.elements || !this.paymentElementReady) {
      this.error = 'Le formulaire de paiement n est pas pret.';
      this.step = 'error';
      this.toast.error(this.error);
      return;
    }
    this.isConfirmingPayment = true;

    try {
      const { error } = await this.stripe.confirmPayment({
        elements: this.elements,
        confirmParams: {
          return_url: window.location.href
        },
        redirect: 'if_required'
      });

      if (error) {
        this.isConfirmingPayment = false;
        this.error = error.message || 'Paiement echoue.';
        this.step = 'error';
        this.toast.error(this.error);
        return;
      }

      if (!this.orderId) {
        this.isConfirmingPayment = false;
        this.error = 'Commande introuvable apres paiement.';
        this.step = 'error';
        this.toast.error(this.error);
        return;
      }

      this.paymentApi.confirmerPaiementCommande(this.orderId).subscribe({
        next: () => {
          this.isConfirmingPayment = false;
          this.step = 'success';
          this.cartService.clear();
          this.toast.success('Paiement effectue avec succes.');
          setTimeout(() => this.success.emit(), 2000);
        },
        error: (e) => {
          this.isConfirmingPayment = false;
          this.error = e.error?.error || e.error?.message || 'Paiement effectue mais statut commande non mis a jour.';
          this.step = 'error';
          this.toast.error(this.error);
        }
      });
    } catch (e: any) {
      this.isConfirmingPayment = false;
      this.error = e?.message || 'Erreur technique pendant la confirmation du paiement.';
      this.step = 'error';
      this.toast.error(this.error);
    }
  }

  retryPayment() {
    this.step = 'summary';
    this.error = '';
  }
}
