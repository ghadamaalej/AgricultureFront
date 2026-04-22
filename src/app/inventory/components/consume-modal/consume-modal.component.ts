import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, Reason } from '../../models/inventory.models';

@Component({
  selector: 'app-consume-modal',
  standalone: false,
  templateUrl: './consume-modal.component.html',
  styleUrls: ['./consume-modal.component.css']
})
export class ConsumeModalComponent {
  @Input() product!: InventoryProduct;
  @Output() consumed  = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

@Input() currentStock = 0;

  loading = false;
  error   = '';

  reasons: Reason[] = ['CONSOMMATION', 'PERTE', 'VENTE', 'PRODUIT_EXPIRE', 'VOL', 'VACCINATION', 'AUTRE'];
  reasonLabels: Record<string, string> = {
    CONSOMMATION: 'Consommation', PERTE: 'Perte', VENTE: 'Vente',
    PRODUIT_EXPIRE: 'Produit expiré', VOL: 'Vol', VACCINATION: 'Vaccination', AUTRE: 'Autre'
  };

  form = new FormGroup({
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    reason: new FormControl<Reason>('CONSOMMATION', Validators.required),
    note: new FormControl('')
  });

  constructor(private api: InventoryApiService) {}

  invalid(f: string) {
    const c = this.form.get(f);
    return !!(c && c.invalid && c.touched);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const quantity = Number(this.form.getRawValue().quantity ?? 0);
    if (quantity > Number(this.product.currentQuantity ?? 0)) {
      this.error = 'La quantité à consommer dépasse le stock disponible.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.api.consumeStock(this.product.id, {
      quantity,
      reason: this.form.getRawValue().reason as Reason,
      note: this.form.getRawValue().note || undefined
    }).subscribe({
      next: () => { this.loading = false; this.consumed.emit(); },
      error: (e) => { this.loading = false; this.error = e.error?.message || 'Erreur'; }
    });
  }
  get stock(): number {
  return Number(this.currentStock || 0);
}
}
