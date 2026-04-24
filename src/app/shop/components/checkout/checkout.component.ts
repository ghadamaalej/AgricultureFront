import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { PaymentApiService, CommandeRequest } from '../../services/payment-api.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-checkout',
  standalone: false,
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  @Output() close   = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  step: 'summary' | 'processing' | 'redirecting' | 'success' | 'error' = 'summary';
  error = '';
  orderId: number | null = null;
  orderRef = '';

  private readonly pendingCheckoutKey = 'pendingCheckoutOrderId';

  constructor(
    public cartService: CartService,
    private paymentApi: PaymentApiService,
    private toast: ToastService,
    private auth: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.handleStripeReturn();
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
        this.orderRef = `CMD-${commande.id}`;

        if (!commande.stripeClientSecret || !/^https?:\/\//i.test(commande.stripeClientSecret)) {
          this.error = 'URL de paiement Stripe invalide.';
          this.step = 'error';
          this.toast.error(this.error);
          return;
        }

        localStorage.setItem(this.pendingCheckoutKey, String(commande.id));
        this.step = 'redirecting';
        window.location.href = commande.stripeClientSecret;
      },
      error: (e) => {
        this.error = e.error?.error || e.error?.message || 'Erreur lors de la creation de la commande.';
        this.step = 'error';
        this.toast.error(this.error);
      }
    });
  }

  private handleStripeReturn() {
    const paymentStatus = this.route.snapshot.queryParamMap.get('payment');
    if (!paymentStatus) {
      return;
    }

    const rawOrderId = localStorage.getItem(this.pendingCheckoutKey);
    const pendingOrderId = rawOrderId ? Number(rawOrderId) : NaN;
    this.clearPaymentQueryParams();

    if (paymentStatus === 'cancel') {
      localStorage.removeItem(this.pendingCheckoutKey);
      this.step = 'error';
      this.error = 'Paiement annule. Vous pouvez reessayer.';
      this.toast.error(this.error);
      return;
    }

    if (paymentStatus === 'success') {
      if (!Number.isFinite(pendingOrderId)) {
        this.step = 'error';
        this.error = 'Paiement effectue, mais la commande est introuvable.';
        this.toast.error(this.error);
        return;
      }

      this.orderId = pendingOrderId;
      this.orderRef = `CMD-${pendingOrderId}`;
      this.step = 'processing';

      this.paymentApi.confirmerPaiementCommande(pendingOrderId).subscribe({
        next: () => {
          localStorage.removeItem(this.pendingCheckoutKey);
          this.step = 'success';
          this.cartService.clear();
          this.toast.success('Paiement effectue avec succes.');
        },
        error: (e) => {
          this.step = 'error';
          this.error = e.error?.error || e.error?.message || 'Paiement effectue mais statut commande non mis a jour.';
          this.toast.error(this.error);
        }
      });
    }
  }

  private clearPaymentQueryParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('payment');
    url.searchParams.delete('session_id');
    const query = url.searchParams.toString();
    const nextUrl = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }

  retryPayment() {
    this.step = 'summary';
    this.error = '';
  }
}
