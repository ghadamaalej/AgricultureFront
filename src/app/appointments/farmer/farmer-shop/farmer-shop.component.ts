import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { InventoryApiService } from 'src/app/inventory/services/inventory-api.service';
import { InventoryProduct } from 'src/app/inventory/models/inventory.models';

@Component({
  selector: 'app-farmer-shop',
  standalone: false,
  templateUrl: './farmer-shop.component.html',
  styleUrls: ['./farmer-shop.component.css']
})
export class FarmerShopComponent implements OnInit {
  @Input() vetId!: number;
  @Input() vetName = '';
  @Output() back = new EventEmitter<void>();

  products: InventoryProduct[] = [];
  loading = true;
  error = '';
  searchTerm = '';
  selectedCategory = '';
  selectedProduct: InventoryProduct | null = null;

  categories = [
    { value: '', label: 'Toutes catégories' },
    { value: 'VACCIN',     label: '💉 Vaccins' },
    { value: 'MEDICAMENT', label: '💊 Médicaments' },
    { value: 'ALIMENT',    label: '🌾 Aliments' },
    { value: 'RECOLTE',    label: '🌿 Récoltes' },
    { value: 'AUTRE',      label: '📦 Autre' },
  ];

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.api.getPublicShop(this.vetId).subscribe({
      next: p => { this.products = p; this.loading = false; },
      error: () => { this.loading = false; this.error = 'Impossible de charger la boutique.'; }
    });
  }

  get filtered(): InventoryProduct[] {
    return this.products.filter(p => {
      const matchSearch = !this.searchTerm ||
        p.nom.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchCat = !this.selectedCategory || p.categorie === this.selectedCategory;
      return matchSearch && matchCat;
    });
  }

  openDetail(p: InventoryProduct) { this.selectedProduct = p; }
  closeDetail() { this.selectedProduct = null; }

  imageUrl(p: InventoryProduct): string {
    return this.api.resolveMediaUrl(p.imageUrl);
  }

  categoryLabel(c: string): string {
    return { VACCIN:'Vaccin', MEDICAMENT:'Médicament', ALIMENT:'Aliment', RECOLTE:'Récolte', AUTRE:'Autre' }[c] || c;
  }

  categoryEmoji(c: string): string {
    return { VACCIN:'💉', MEDICAMENT:'💊', ALIMENT:'🌾', RECOLTE:'🌿', AUTRE:'📦' }[c] || '📦';
  }

  get inStockCount()    { return this.products.filter(p => (p.currentQuantity ?? 0) > 0).length; }
  get outOfStockCount() { return this.products.filter(p => !((p.currentQuantity ?? 0) > 0)).length; }
}
