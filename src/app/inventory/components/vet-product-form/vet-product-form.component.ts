import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, CreateProductRequest, UpdateProductRequest } from '../../models/inventory.models';
import { ToastService } from 'src/app/core/services/toast.service';

// Catégories vétérinaires uniquement (pas de RECOLTE)
type VetCategory = 'VACCIN' | 'MEDICAMENT' | 'ALIMENT' | 'AUTRE';

@Component({
  selector: 'app-vet-product-form',
  standalone: false,
  templateUrl: './vet-product-form.component.html',
  styleUrls: ['./vet-product-form.component.css']
})
export class VetProductFormComponent implements OnInit {
  @Input() product: InventoryProduct | null = null;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading = false;
  error = '';

  categories: VetCategory[] = ['VACCIN', 'MEDICAMENT', 'ALIMENT', 'AUTRE'];

  catConfig: Record<VetCategory, { label: string; emoji: string; color: string; units: string[] }> = {
    VACCIN:     { label: 'Vaccin',       emoji: '💉', color: '#1565c0', units: ['dose', 'flacon', 'ampoule', 'ml'] },
    MEDICAMENT: { label: 'Médicament',   emoji: '💊', color: '#6a1b9a', units: ['comprimé', 'ml', 'mg', 'sachet', 'flacon'] },
    ALIMENT:    { label: 'Aliment',      emoji: '🌾', color: '#2e7d32', units: ['kg', 'g', 'L', 'sac', 'boîte'] },
    AUTRE:      { label: 'Autre',        emoji: '📦', color: '#e65100', units: ['pièce', 'unité', 'boîte', 'lot'] },
  };

  constructor(private api: InventoryApiService, private toast: ToastService) {}

  ngOnInit() {
    this.form = new FormGroup({
      nom:          new FormControl(this.product?.nom          || '', Validators.required),
      categorie:    new FormControl(this.product?.categorie    || '', Validators.required),
      unit:         new FormControl(this.product?.unit         || '', Validators.required),
      isPerishable: new FormControl(this.product?.isPerishable ?? true),
      minThreshold: new FormControl(this.product?.minThreshold ?? 0,
                      [Validators.required, Validators.min(0)]),
      note:         new FormControl(this.product?.note ?? ''),
    });
  }

  get isEdit() { return !!this.product; }

  get selectedCat(): VetCategory | null {
    const v = this.form.get('categorie')?.value;
    return v ? v as VetCategory : null;
  }

  get suggestedUnits(): string[] {
    const cat = this.selectedCat;
    return cat ? this.catConfig[cat].units : [];
  }

  selectUnit(u: string) { this.form.get('unit')?.setValue(u); }

  invalid(f: string) {
    const c = this.form.get(f);
    return !!(c && c.invalid && c.touched);
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.error = '';
    const val = this.form.getRawValue();

    const req: CreateProductRequest | UpdateProductRequest = {
      nom:             val.nom.trim(),
      categorie:       val.categorie,
      unit:            val.unit.trim(),
      isPerishable:    !!val.isPerishable,
      currentQuantity: this.isEdit ? Number(this.product?.currentQuantity ?? 0) : 0,
      minThreshold:    Number(val.minThreshold),
      note:            (val.note || '').trim() || null,
    };

    const obs = this.isEdit
      ? this.api.updateProduct(this.product!.id, req)
      : this.api.createProduct(req);

    obs.subscribe({
      next: () => {
        this.loading = false;
        this.toast.success(this.isEdit
          ? `Produit "${val.nom}" modifié avec succès !`
          : `Produit "${val.nom}" ajouté à l'inventaire !`
        );
        this.saved.emit();
      },
      error: (e) => {
        this.loading = false;
        this.error = e.error?.message || 'Erreur serveur';
        this.toast.error(this.error);
      }
    });
  }
}
