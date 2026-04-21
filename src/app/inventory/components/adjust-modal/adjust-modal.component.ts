import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct } from '../../models/inventory.models';

@Component({
  selector: 'app-adjust-modal',
  standalone: false,
  templateUrl: './adjust-modal.component.html',
  styleUrls: ['./adjust-modal.component.css']
})
export class AdjustModalComponent {
  @Input() product!: InventoryProduct;
  @Output() adjusted  = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  loading = false;
  error   = '';

  form = new FormGroup({
    quantity: new FormControl<number|null>(null, Validators.required),
    note:     new FormControl('')
  });

  constructor(private api: InventoryApiService) {}

  invalid(f: string) { const c = this.form.get(f); return c && c.invalid && c.touched; }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.api.adjustStock(this.product.id, this.form.value as any).subscribe({
      next:  () => { this.loading = false; this.adjusted.emit(); },
      error: (e) => { this.loading = false; this.error = e.error?.message || 'Erreur'; }
    });
  }
}
