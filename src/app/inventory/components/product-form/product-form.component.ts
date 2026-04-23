import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, ProductCategory, CreateProductRequest, UpdateProductRequest } from '../../models/inventory.models';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-product-form',
  standalone: false,
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit {
  @Input() product: InventoryProduct | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading = false;
  error = '';

  categories: ProductCategory[] = ['VACCIN', 'MEDICAMENT', 'ALIMENT', 'RECOLTE', 'AUTRE'];
  catLabels: Record<string, string> = {
    VACCIN: 'Vaccin', MEDICAMENT: 'Médicament', ALIMENT: 'Aliment', RECOLTE: 'Récolte', AUTRE: 'Autre'
  };

  constructor(private api: InventoryApiService, private toast: ToastService) {}

  ngOnInit() {
    this.form = new FormGroup({
      nom: new FormControl(this.product?.nom || '', Validators.required),
      categorie: new FormControl(this.product?.categorie || '', Validators.required),
      unit: new FormControl(this.product?.unit || '', Validators.required),
      isPerishable: new FormControl(this.product?.isPerishable ?? false),
      minThreshold: new FormControl(this.product?.minThreshold ?? 0, [Validators.required, Validators.min(0)]),
      note: new FormControl(this.product?.note ?? ''),
    });
  }

  get isEdit() { return !!this.product; }

  invalid(f: string) {
    const c = this.form.get(f);
    return !!(c && c.invalid && c.touched);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const val = this.form.getRawValue();

    const req: CreateProductRequest | UpdateProductRequest = {
      nom: (val.nom || '').trim(),
      categorie: val.categorie,
      unit: (val.unit || '').trim(),
      isPerishable: !!val.isPerishable,
      currentQuantity: this.isEdit ? Number(this.product?.currentQuantity ?? 0) : 0,
      minThreshold: Number(val.minThreshold ?? 0),
      note: (val.note || '').trim() || null,
    };

    const obs = this.isEdit
      ? this.api.updateProduct(this.product!.id, req)
      : this.api.createProduct(req);

    obs.subscribe({
      next: () => {
        this.loading = false;
        this.toast.success(this.isEdit
          ? `Produit "${val.nom}" modifié avec succès !`
          : `Produit "${val.nom}" ajouté avec succès !`
        );
        this.saved.emit();
      },
      error: (e) => {
        this.loading = false;
        
        
        this.error = e.error?.message || 'Erreur';
        this.toast.error(this.error);
      }
    });
  }
}
