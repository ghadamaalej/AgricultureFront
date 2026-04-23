import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct } from '../../models/inventory.models';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-vet-shop',
  standalone: false,
  templateUrl: './vet-shop.component.html',
  styleUrls: ['./vet-shop.component.css']
})
export class VetShopComponent implements OnInit {
  @Output() goToInventory = new EventEmitter<void>();
  products: InventoryProduct[] = [];
  loading = true;
  error = '';

  showForm = false;
  editingProduct: InventoryProduct | null = null;
  formLoading = false;
  selectedImage: File | null = null;
  imagePreview: string | null = null;

  form = new FormGroup({
    prixVente:   new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    description: new FormControl(''),
    enBoutique:  new FormControl(true),
  });

  constructor(private api: InventoryApiService, private toast: ToastService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getMyProducts().subscribe({
      next: p => { this.products = p; this.loading = false; },
      error: e => { this.loading = false; this.error = e.error?.message || 'Erreur'; }
    });
  }

  openEdit(p: InventoryProduct) {
    this.editingProduct = p;
    this.form.patchValue({
      prixVente:   p.prixVente ?? null,
      description: p.description ?? '',
      enBoutique:  p.enBoutique ?? false,
    });
    this.imagePreview = this.api.resolveMediaUrl(p.imageUrl) || null;
    this.selectedImage = null;
    this.showForm = true;
  }

  cancelForm() {
    this.showForm = false; this.editingProduct = null;
    this.selectedImage = null; this.imagePreview = null;
  }

  onImageSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedImage = file;
    const reader = new FileReader();
    reader.onload = () => this.imagePreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  removeImage() { this.selectedImage = null; this.imagePreview = null; }

  submitForm() {
    if (this.form.invalid || !this.editingProduct) { this.form.markAllAsTouched(); return; }
    this.formLoading = true;
    const v = this.form.getRawValue();
    this.api.updateBoutiqueInfo(
      this.editingProduct.id,
      { prixVente: v.prixVente!, description: v.description || '', enBoutique: v.enBoutique! },
      this.selectedImage || undefined
    ).subscribe({
      next: () => {
        this.formLoading = false;
        this.toast.success('Informations boutique mises à jour !');
        this.cancelForm(); this.load();
      },
      error: e => {
        this.formLoading = false;
        this.toast.error(e.error?.message || 'Erreur lors de la mise à jour');
      }
    });
  }

  toggle(p: InventoryProduct) {
    this.api.toggleBoutique(p.id).subscribe({
      next: updated => {
        const msg = updated.enBoutique ? `"${p.nom}" visible dans la boutique !` : `"${p.nom}" masqué de la boutique.`;
        this.toast.success(msg);
        this.load();
      },
      error: () => this.toast.error('Erreur lors du changement de visibilité')
    });
  }

  imageUrl(p: InventoryProduct): string {
    return this.api.resolveMediaUrl(p.imageUrl);
  }

  categoryLabel(c: string) {
    return { VACCIN:'Vaccin', MEDICAMENT:'Médicament', ALIMENT:'Aliment', RECOLTE:'Récolte', AUTRE:'Autre' }[c] || c;
  }

  categoryEmoji(c: string) {
    return { VACCIN:'💉', MEDICAMENT:'💊', ALIMENT:'🌾', RECOLTE:'🌿', AUTRE:'📦' }[c] || '📦';
  }

  invalid(f: string) { const c = this.form.get(f); return !!(c && c.invalid && c.touched); }

  get inBoutiqueCount() { return this.products.filter(p => p.enBoutique).length; }
  get inStockCount()    { return this.products.filter(p => (p.currentQuantity ?? 0) > 0).length; }
}
