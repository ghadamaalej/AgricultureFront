import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../../services/cart/cart.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-order-history',
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.css']
})
export class OrderHistoryComponent implements OnInit {
  currentUserId: number | null = null;
  orders: any[] = [];
  loading = false;

  factures: any[] = [];

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
  this.currentUserId = this.authService.getCurrentUserId();

  if (!this.currentUserId) {
    this.loading = false;
    return;
  }

  this.loading = true;

  this.cartService.getPaidOrders(this.currentUserId).subscribe({
    next: (res) => {
      this.orders = res || [];
      this.loading = false;
    },
    error: (err) => {
      console.error('Failed to load order history', err);
      this.loading = false;
    }
  });

  this.loadFactures();
}

  openOrder(order: any): void {
    this.router.navigate(['/marketplace/orders', order.commandeId]);
  }

  loadFactures(): void {
  if (!this.currentUserId) return;

  this.cartService.getPaidPaymentsByUser(this.currentUserId).subscribe({
    next: (data) => {
      this.factures = Array.isArray(data)
        ? data
            .filter((payment: any) => payment.facture)
            .map((payment: any) => ({
              idFacture: payment.facture.idFacture,
              numero: payment.facture.numero,
              date: payment.facture.date,
              total: payment.facture.total,
              pdfUrl: payment.facture.pdfUrl,
              paiementReference: payment.reference,
              methode: payment.methode,
              datePaiement: payment.datePaiement
            }))
        : [];
    },
    error: (err) => {
      console.error('Error loading factures:', err);
      this.factures = [];
    }
  });
}
openFacture(facture: any): void {
  if (!facture?.idFacture) return;

  window.open(
    `http://localhost:8089/paiement/api/factures/${facture.idFacture}/pdf`,
    '_blank'
  );
}
}