import { Component, OnInit } from '@angular/core';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, Batch } from '../../models/inventory.models';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-vet-product-list',
  standalone: false,
  templateUrl: './vet-product-list.component.html',
  styleUrls: ['./vet-product-list.component.css']
})
export class VetProductListComponent implements OnInit {

  products: InventoryProduct[] = [];
  loading = true;
  error = '';
  searchTerm = '';
  filterCat = '';

  view: 'list' | 'movements' | 'batches' = 'list';
  selectedProduct: InventoryProduct | null = null;
  batches: Batch[] = [];

  showProductForm = false;
  showConsumeModal = false;
  showAdjustModal = false;
  editingProduct: InventoryProduct | null = null;

  // Catégories vétérinaires uniquement
  categories = [
    { value: '',           label: 'Toutes',      emoji: '🔍' },
    { value: 'VACCIN',     label: 'Vaccins',      emoji: '💉' },
    { value: 'MEDICAMENT', label: 'Médicaments',  emoji: '💊' },
    { value: 'ALIMENT',    label: 'Aliments',     emoji: '🌾' },
    { value: 'AUTRE',      label: 'Autre',        emoji: '📦' },
  ];

  catConfig: Record<string, { label: string; emoji: string; color: string }> = {
    VACCIN:     { label: 'Vaccin',     emoji: '💉', color: '#1565c0' },
    MEDICAMENT: { label: 'Médicament', emoji: '💊', color: '#6a1b9a' },
    ALIMENT:    { label: 'Aliment',    emoji: '🌾', color: '#2e7d32' },
    RECOLTE:    { label: 'Récolte',    emoji: '🌿', color: '#558b2f' },
    AUTRE:      { label: 'Autre',      emoji: '📦', color: '#e65100' },
  };

  constructor(private api: InventoryApiService, private toast: ToastService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.error = '';
    this.api.getMyProducts().subscribe({
      next: p => { this.products = p; this.loading = false; },
      error: e => {
        this.loading = false;
        this.error = e.status === 0
          ? 'Impossible de joindre le serveur. Vérifiez que le backend est démarré.'
          : e.error?.message || 'Erreur de chargement.';
      }
    });
  }

  get filtered(): InventoryProduct[] {
    return this.products.filter(p => {
      const matchSearch = !this.searchTerm ||
        p.nom.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchCat = !this.filterCat || p.categorie === this.filterCat;
      return matchSearch && matchCat;
    });
  }

  openAdd()                    { this.editingProduct = null; this.showProductForm = true; }
  openEdit(p: InventoryProduct){ this.editingProduct = p; this.showProductForm = true; }
  onProductSaved()             { this.showProductForm = false; this.load(); }

  delete(p: InventoryProduct) {
    if (!confirm(`Supprimer "${p.nom}" de l'inventaire clinique ?`)) return;
    this.api.deleteProduct(p.id).subscribe({
      next: () => { this.toast.success(`"${p.nom}" supprimé avec succès !`); this.load(); },
      error: e  => this.toast.error(e.error?.message || 'Erreur lors de la suppression.')
    });
  }

  openBatches(p: InventoryProduct) {
    this.selectedProduct = { ...p };
    this.view = 'batches';
    this.api.getProductBatches(p.id).subscribe({ next: b => this.batches = b });
  }

  openMovements() { this.view = 'movements'; }

  backToList() {
    this.view = 'list';
    this.selectedProduct = null;
    this.load();
  }

  openConsume(p: InventoryProduct) { this.selectedProduct = { ...p }; this.showConsumeModal = true; }
  openAdjust(p: InventoryProduct)  { this.selectedProduct = { ...p }; this.showAdjustModal = true; }

  onConsumed() {
    this.showConsumeModal = false;
    this.load();
    if (this.view === 'batches' && this.selectedProduct) {
      this.api.getProductBatches(this.selectedProduct.id)
        .subscribe({ next: b => this.batches = b });
    }
  }

  onAdjusted() {
    this.showAdjustModal = false;
    this.load();
    if (this.view === 'batches' && this.selectedProduct) {
      this.api.getProductBatches(this.selectedProduct.id)
        .subscribe({ next: b => this.batches = b });
    }
  }

  onStockAdded() { this.load(); }

  isLowStock(p: InventoryProduct) {
    return (p.currentQuantity ?? 0) <= (p.minThreshold ?? 0);
  }

  get currentStock(): number {
    return this.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
  }

  // Stats
  get totalProducts()   { return this.products.length; }
  get lowStockCount()   { return this.products.filter(p => this.isLowStock(p)).length; }
  get outOfStockCount() { return this.products.filter(p => (p.currentQuantity ?? 0) === 0).length; }

  getStockPercent(p: InventoryProduct): number {
    const max = Math.max((p.minThreshold ?? 0) * 3, p.currentQuantity ?? 0, 1);
    return Math.min(100, Math.round(((p.currentQuantity ?? 0) / max) * 100));
  }
}
