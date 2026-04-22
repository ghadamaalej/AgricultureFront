import { Component, OnInit } from '@angular/core';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, Batch } from '../../models/inventory.models';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-list',
  standalone: false,
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit {
  products: InventoryProduct[] = [];
  loading = true;
  error = '';

  view: 'list' | 'movements' | 'batches' = 'list';
  selectedProduct: InventoryProduct | null = null;
  batches: Batch[] = [];

  showProductForm = false;
  showConsumeModal = false;
  showAdjustModal = false;
  editingProduct: InventoryProduct | null = null;

  constructor(private api: InventoryApiService ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.error = '';
    this.api.getMyProducts().subscribe({
      next: p => { this.products = p; this.loading = false; },
      error: (e) => {
        this.loading = false;
        if (e.status === 0) {
          this.error = 'Impossible de joindre le serveur (port 8088). Vérifiez que le backend est démarré.';
        } else {
          this.error = e.error?.message || 'Erreur de chargement des produits.';
        }
      }
    });
  }

  openAdd() { this.editingProduct = null; this.showProductForm = true; }
  openEdit(p: InventoryProduct) { this.editingProduct = p; this.showProductForm = true; }

  onProductSaved() {

    this.showProductForm = false;
    this.editingProduct = null;
   
    this.load();
  }

  delete(p: InventoryProduct) {
    if (!confirm(`Supprimer "${p.nom}" ?`)) return;
    this.api.deleteProduct(p.id).subscribe({ next: () => this.load() });
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

  onConsumed()  {
    this.showConsumeModal = false;
    this.load();
    if (this.view === 'batches' && this.selectedProduct) {
      this.api.getProductBatches(this.selectedProduct.id).subscribe({ next: b => this.batches = b });
    }
  }

  onAdjusted()  {
    this.showAdjustModal = false;
    this.load();
    if (this.view === 'batches' && this.selectedProduct) {
      this.api.getProductBatches(this.selectedProduct.id).subscribe({ next: b => this.batches = b });
    }
  }

  onStockAdded() {
    this.load();
  }

  isLowStock(p: InventoryProduct) { return p.currentQuantity <= p.minThreshold; }

  categoryLabel(c: string): string {
    const map: Record<string, string> = {
      VACCIN: 'Vaccin', MEDICAMENT: 'Médicament', ALIMENT: 'Aliment',
      RECOLTE: 'Récolte', AUTRE: 'Autre'
    };
    return map[c] || c;
  }
get currentStock(): number {
  return this.batches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
}

}
