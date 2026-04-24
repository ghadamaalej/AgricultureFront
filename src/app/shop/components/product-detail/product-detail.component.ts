import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { InventoryProduct } from 'src/app/inventory/models/inventory.models';
import { CartService } from '../../services/cart.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { InventoryApiService } from 'src/app/inventory/services/inventory-api.service';

@Component({
  selector: 'app-product-detail',
  standalone: false,
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit {
  @Input() product!: InventoryProduct;
  @Input() vetId = 0;
  @Input() vetNom = '';
  @Input() vetRegion = '';
  @Output() close       = new EventEmitter<void>();
  @Output() openCart    = new EventEmitter<void>();

  quantity = 1;
  addedToCart = false;

  constructor(
    public cartService: CartService,
    private toast: ToastService,
    private inventoryApi: InventoryApiService
  ) {}

  ngOnInit() {
    const inCart = this.cartService.getQuantity(this.product.id);
    this.quantity = inCart > 0 ? inCart : 1;
    this.addedToCart = inCart > 0;
  }

  get max(): number { return Math.max(1, this.product.currentQuantity ?? 0); }
  get canAdd(): boolean { return (this.product.currentQuantity ?? 0) > 0; }

  increment() { if (this.quantity < this.max) this.quantity++; }
  decrement() { if (this.quantity > 1) this.quantity--; }

  addToCart() {
    if (!this.canAdd) return;
    const added = this.cartService.addItem(this.product, this.quantity, this.vetId, this.vetNom, this.vetRegion);
    if (added) {
      this.addedToCart = true;
      this.toast.success(`"${this.product.nom}" ajouté au panier !`);
    }
  }

  imageUrl(): string {
    return this.inventoryApi.resolveMediaUrl(this.product.imageUrl);
  }

  categoryLabel(c: string) {
    return { VACCIN:'Vaccin', MEDICAMENT:'Médicament', ALIMENT:'Aliment', RECOLTE:'Récolte', AUTRE:'Autre' }[c] || c;
  }

  categoryEmoji(c: string) {
    return { VACCIN:'💉', MEDICAMENT:'💊', ALIMENT:'🌾', RECOLTE:'🌿', AUTRE:'📦' }[c] || '📦';
  }
}
