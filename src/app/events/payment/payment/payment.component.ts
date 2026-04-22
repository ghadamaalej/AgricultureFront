import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReservationService, Reservation } from 'src/app/services/reservation/reservation.service';
import { EventService } from 'src/app/services/event/event.service';
import { Events } from 'src/app/models/events';


declare var Stripe: any;

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css']
})
export class PaymentComponent implements OnInit, OnDestroy {

  reservation: Reservation | null = null;
  event: Events | null = null;
  reservationId!: number;

  stripe: any;
  elements: any;
  clientSecret = '';
  paymentIntentId = '';

  loading = true;
  processingPayment = false;
  paymentSuccess = false;
  paymentError = '';
  cancelLoading = false;
  cancelError = '';
  cancelSuccess = false;
  stripeReady = false;

  private readonly STRIPE_PK = 'pk_test_51QwSRHGbxwIj6q0UzALmTTfLsrdnon59WYddXCY9IeADzyxNj7fT1ajmekBgRsWvvXrkFzAyiOGLO6tJIDDnlFel00SXJ9nmMR';

  constructor(private route: ActivatedRoute,private router: Router,private reservationService: ReservationService,private eventService: EventService,private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.reservationId = Number(this.route.snapshot.paramMap.get('reservationId'));
    console.log("PARAM:", this.reservationId);
    this.loadData();
  }

  loadData(): void {
  if (!this.reservationId || isNaN(this.reservationId)) {
    this.paymentError = 'ID de réservation invalide';
    this.loading = false;
    return;
  }

  this.reservationService.getReservation(this.reservationId).subscribe({
    next: (res) => {
      if (!res) {
        this.paymentError = 'Réservation non trouvée';
        this.loading = false;
        return;
      }
      
      this.reservation = res;
      
      if (!res.evenement) {
        this.paymentError = 'Événement associé non trouvé';
        this.loading = false;
        return;
      }
      
      const eventId = (res.evenement as any)?.id ?? res.evenement;
      
      if (!eventId) {
        this.paymentError = 'ID d\'événement invalide';
        this.loading = false;
        return;
      }
      
      this.eventService.getEventById(Number(eventId)).subscribe({
        next: (ev) => {
          this.event = ev;
          this.loading = false;
          this.cdr.detectChanges();
          this.initStripe();
        },
        error: (err) => {
          console.error('Error loading event:', err);
          this.paymentError = 'Impossible de charger les détails de l\'événement';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    },
    error: (err) => {
      console.error('Error loading reservation:', err);
      this.paymentError = 'Impossible de charger la réservation';
      this.loading = false;
      this.cdr.detectChanges();
    }
  });
}

  initStripe(): void {
    if (typeof Stripe === 'undefined') {
      this.paymentError = 'Stripe.js failed to load. Please refresh the page.';
      return;
    }

    if (this.reservation && this.reservation.montant === 0) {
      this.stripeReady = true;
      return;
    }

    this.stripe = Stripe(this.STRIPE_PK);

    this.reservationService.createPaymentIntent(this.reservationId).subscribe({
      next: (data) => {
        this.clientSecret = data.clientSecret;
        this.paymentIntentId = data.paymentIntentId;
        setTimeout(() => this.mountCardElement(), 0);
      },
      error: (err) => {
        console.error('PaymentIntent error:', err);
        this.paymentError = 'Failed to initialize payment. Please try again.';
      }
    });
  }

  mountCardElement(): void {
    const el = document.getElementById('stripe-payment-element');
    if (!el) {
      // DOM not ready yet — retry after short delay
      setTimeout(() => this.mountCardElement(), 100);
      return;
    }

    const appearance = {
      theme: 'stripe',
      variables: {
        colorPrimary: '#3cb054',
        colorBackground: '#ffffff',
        colorText: '#1a2c1e',
        colorDanger: '#dc3545',
        fontFamily: '"Nunito", sans-serif',
        spacingUnit: '4px',
        borderRadius: '10px',
      },
      rules: {
        '.Input': { border: '1.5px solid rgba(60,176,84,0.3)', boxShadow: 'none' },
        '.Input:focus': { border: '1.5px solid #3cb054', boxShadow: '0 0 0 3px rgba(60,176,84,0.15)' },
        '.Label': { color: '#526257', fontSize: '13px', fontWeight: '600' }
      }
    };

    this.elements = this.stripe.elements({ clientSecret: this.clientSecret, appearance });
    const paymentElement = this.elements.create('payment');
    paymentElement.mount('#stripe-payment-element');

    paymentElement.on('ready', () => {
      this.stripeReady = true;
      this.cdr.detectChanges();
    });
    paymentElement.on('change', (event: any) => {
      this.paymentError = event.error ? event.error.message : '';
      this.cdr.detectChanges();
    });
  }

  async pay(): Promise<void> {
    if (!this.stripe || !this.elements || this.processingPayment) return;

    this.processingPayment = true;
    this.paymentError = '';

    const { error, paymentIntent } = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href }
    });

    if (error) {
      this.paymentError = error.message || 'Payment failed. Please try again.';
      this.processingPayment = false;
      this.cdr.detectChanges();
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      this.reservationService.confirmPayment(this.reservationId, paymentIntent.id).subscribe({
        next: () => {
          this.processingPayment = false;
          this.paymentSuccess = true;
          this.cdr.detectChanges();
        },
        error: () => {
          this.processingPayment = false;
          this.paymentError = 'Payment received but confirmation failed. Please contact support.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  cancelReservation(): void {
    if (this.cancelLoading) return;
    this.cancelLoading = true;
    this.cancelError = '';

    this.reservationService.cancelReservation(this.reservationId).subscribe({
      next: (res) => {
        this.cancelLoading = false;
        if (res.status === 'success') {
          this.cancelSuccess = true;
          this.cdr.detectChanges();
          setTimeout(() => this.router.navigate(['/events/listEvents']), 2000);
        } else {
          this.cancelError = res.message;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.cancelLoading = false;
        this.cancelError = 'Failed to cancel. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  goToEvents(): void {
    this.router.navigate(['/events/listEvents']);
  }

  ngOnDestroy(): void {
    if (this.elements) {
      try { this.elements.getElement('payment')?.destroy(); } catch (_) {}
    }
  }
}