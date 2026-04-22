import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RentalPaymentService } from '../../../services/rental-payment/rental-payment.service';

@Component({
  selector: 'app-rental-payment',
  templateUrl: './rental-payment.component.html',
  styleUrls: ['./rental-payment.component.css']
})
export class RentalPaymentComponent implements OnInit {

  proposalId!: number;

  payments: any[] = [];
  loading = false;
  activating = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rentalPaymentService: RentalPaymentService
  ) {}

  ngOnInit(): void {
    this.proposalId = Number(this.route.snapshot.paramMap.get('proposalId'));

    if (!this.proposalId) {
      this.errorMessage = 'Invalid proposal.';
      return;
    }

    this.loadPayments();
  }

  loadPayments(): void {
    this.loading = true;

    this.rentalPaymentService.getPaymentsByProposition(this.proposalId).subscribe({
      next: (res) => {
        this.payments = res || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Could not load rental payments', err);
        this.errorMessage = 'Could not load rental payment schedule.';
        this.loading = false;
      }
    });
  }

  activateAutoPayment(): void {
    this.activating = true;

    this.rentalPaymentService.setupCard(this.proposalId).subscribe({
      next: (res) => {
        this.activating = false;

        if (res?.url) {
          window.location.href = res.url;
          return;
        }

        alert('Stripe setup URL not received.');
      },
      error: (err) => {
        console.error('Auto payment activation failed', err);
        this.activating = false;
        alert('Could not activate automatic payment.');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/marketplace/my-rental-proposals']);
  }

  isAutoPaymentActive(): boolean {
    return this.payments.some(p => p.stripeCustomerId && p.stripePaymentMethodId);
  }

  getPaidCount(): number {
    return this.payments.filter(p => p.statut === 'PAID').length;
  }

  getTotalAmount(): number {
    return this.payments.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  }

  getPaidAmount(): number {
    return this.payments
      .filter(p => p.statut === 'PAID')
      .reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  }

  getNextPayment(): any {
    return this.payments.find(p => p.statut === 'UNPAID' || p.statut === 'FAILED') || null;
  }

  getStatusClass(status: string): string {
    if (status === 'PAID') return 'paid';
    if (status === 'FAILED') return 'failed';
    return 'unpaid';
  }
}