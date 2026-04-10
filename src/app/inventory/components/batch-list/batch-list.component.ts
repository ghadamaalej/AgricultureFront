import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, Batch } from '../../models/inventory.models';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-batch-list',
  standalone: false,
  templateUrl: './batch-list.component.html',
  styleUrls: ['./batch-list.component.css']
})
export class BatchListComponent implements OnInit, OnChanges {
  @Input() product!: InventoryProduct;
  @Input() batches: Batch[] = [];
  @Input() openAddStockOnLoad = false;

  @Output() back = new EventEmitter<void>();
  @Output() consume = new EventEmitter<void>();
  @Output() adjust = new EventEmitter<void>();
  @Output() stockAdded = new EventEmitter<void>();

  internalBatches: Batch[] = [];
  loadingBatches = false;

  showAddStock = false;
  addLoading = false;
  addError = '';

  addForm = new FormGroup({
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    purchaseDate: new FormControl('', Validators.required),
    expiryDate: new FormControl(''),
    note: new FormControl('')
  });

  constructor(
    private api: InventoryApiService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loadBatches();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['batches']) {
      this.internalBatches = [...this.batches];
    }

    if (changes['product'] && this.product?.id) {
      this.loadBatches();
    }

    if (changes['openAddStockOnLoad'] && this.openAddStockOnLoad && !this.showAddStock) {
      this.openAddStock();
    }
  }

  loadBatches() {
    if (!this.product?.id) return;

    this.loadingBatches = true;

    this.api.getProductBatches(this.product.id).subscribe({
      next: (b) => {
        this.internalBatches = b;
        this.loadingBatches = false;
      },
      error: () => {
        this.loadingBatches = false;
        this.toast.error('Erreur lors du chargement des lots.');
      }
    });
  }

  openAddStock() {
    this.addForm.reset({
      quantity: null,
      price: null,
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      note: ''
    });
    this.addError = '';
    this.showAddStock = true;
  }

  cancelAddStock() {
    this.showAddStock = false;
  }

  submitAddStock() {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.addLoading = true;
    this.addError = '';

    const v = this.addForm.value;

    this.api.addStock(this.product.id, {
      quantity: Number(v.quantity),
      price: Number(v.price),
      purchaseDate: v.purchaseDate!,
      expiryDate: v.expiryDate || null,
      note: v.note || null
    }).subscribe({
      next: () => {
        this.addLoading = false;
        this.showAddStock = false;
        this.toast.success(`Stock ajouté avec succès pour "${this.product.nom}".`);
        this.loadBatches();
        this.stockAdded.emit();
      },
      error: (e) => {
        this.addLoading = false;
        this.addError = e.error?.message || 'Erreur lors de l’ajout du stock';
        this.toast.error(this.addError);
      }
    });
  }

  invalid(field: string): boolean {
    const c = this.addForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  isExpiringSoon(expiryDate: string | null): boolean {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const in30days = new Date();
    in30days.setDate(in30days.getDate() + 30);
    return expiry <= in30days;
  }

  get totalStock(): number {
    return this.internalBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
  }
}