import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, Batch } from '../../models/inventory.models';

@Component({
  selector: 'app-batch-list',
  standalone: false,
  templateUrl: './batch-list.component.html',
  styleUrls: ['./batch-list.component.css']
})
export class BatchListComponent implements OnInit, OnChanges {
  @Input() product!: InventoryProduct;
  @Input() batches: Batch[] = [];   // kept for backwards compat but we reload internally
  @Output() back       = new EventEmitter<void>();
  @Output() consume    = new EventEmitter<void>();
  @Output() adjust     = new EventEmitter<void>();
  @Output() stockAdded = new EventEmitter<void>();

  // Internal batches list (self-managed)
  internalBatches: Batch[] = [];
  loadingBatches = false;

  // Add stock modal
  showAddStock = false;
  addLoading   = false;
  addError     = '';

  addForm = new FormGroup({
    quantity:     new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    purchaseDate: new FormControl('', Validators.required),
    expiryDate:   new FormControl(''),
    note:         new FormControl(''),
  });

  constructor(private api: InventoryApiService) {}

  ngOnInit() { this.loadBatches(); }

  // If product changes (e.g. parent updates it), reload
  ngOnChanges() {
    if (this.product?.id) this.loadBatches();
  }

  loadBatches() {
    if (!this.product?.id) return;
    this.loadingBatches = true;
    this.api.getProductBatches(this.product.id).subscribe({
      next: b => { this.internalBatches = b; this.loadingBatches = false; },
      error: () => { this.loadingBatches = false; }
    });
  }

  openAddStock() {
    this.addForm.reset({ purchaseDate: new Date().toISOString().split('T')[0] });
    this.addError    = '';
    this.showAddStock = true;
  }

  cancelAddStock() { this.showAddStock = false; }

  submitAddStock() {
    if (this.addForm.invalid) { this.addForm.markAllAsTouched(); return; }
    this.addLoading = true;
    this.addError   = '';
    const v = this.addForm.value;
    this.api.addStock(this.product.id, {
      quantity:     v.quantity!,
      purchaseDate: v.purchaseDate!,
      expiryDate:   v.expiryDate || null,
      note:         v.note || null,
    }).subscribe({
      next: updatedProduct => {
        this.addLoading = false;
        this.showAddStock = false;
        // Update stock display immediately
        this.product = { ...this.product, currentQuantity: updatedProduct.currentQuantity };
        // Reload batches immediately
        this.loadBatches();
        // Notify parent to refresh product list
        this.stockAdded.emit();
      },
      error: (e) => {
        this.addLoading = false;
        this.addError = e.error?.message || 'Erreur lors de l\'ajout du stock';
      }
    });
  }

  invalid(f: string) { const c = this.addForm.get(f); return c && c.invalid && c.touched; }

  isExpiringSoon(expiryDate: string | null): boolean {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const in30days = new Date();
    in30days.setDate(in30days.getDate() + 30);
    return expiry <= in30days;
  }
}
