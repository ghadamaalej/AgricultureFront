import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { InventoryApiService } from 'src/app/inventory/services/inventory-api.service';
import { InventoryProduct } from 'src/app/inventory/models/inventory.models';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-global-shop',
  standalone: false,
  templateUrl: './global-shop.component.html',
  styleUrls: ['./global-shop.component.css']
})
export class GlobalShopComponent implements OnInit {
  @Output() back = new EventEmitter<void>();

  products: InventoryProduct[] = [];
  loading = true;
  error = '';

  searchTerm = '';
  filterCat  = '';
  filterRegion = '';

  aiQuery = '';
  aiLoading = false;
  aiResults: InventoryProduct[] | null = null;
  aiError = '';
  showAiPanel = false;

  selectedProduct: InventoryProduct | null = null;
  showCart = false;
  showCheckout = false;

  categories = [
    { value: '',           label: 'Toutes' },
    { value: 'VACCIN',     label: '💉 Vaccins' },
    { value: 'MEDICAMENT', label: '💊 Médicaments' },
    { value: 'ALIMENT',    label: '🌾 Aliments' },
    { value: 'AUTRE',      label: '📦 Autre' },
  ];

  constructor(
    private api: InventoryApiService,
    public cartService: CartService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadShop();
    this.openCheckoutOnStripeReturn();
  }

  private openCheckoutOnStripeReturn() {
    const paymentStatus = this.route.snapshot.queryParamMap.get('payment');
    if (paymentStatus === 'success' || paymentStatus === 'cancel') {
      this.showCart = false;
      this.showCheckout = true;
    }
  }

  private loadShop() {
    this.loading = true;
    this.error = '';
    this.api.getAllPublicShop().subscribe({
      next: p => { this.products = p; this.loading = false; },
      error: () => { this.loading = false; this.error = 'Impossible de charger la boutique.'; }
    });
  }

  get regions(): string[] {
    const set = new Set<string>();
    this.products.forEach(p => {
      if (p.owner?.region) set.add(p.owner.region);
    });
    return Array.from(set).sort();
  }

  get displayProducts(): InventoryProduct[] {
    const source = this.aiResults !== null ? this.aiResults : this.products;
    return source.filter(p => {
      const matchSearch = !this.searchTerm ||
        p.nom.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.owner?.nom || '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.owner?.region || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchCat    = !this.filterCat    || p.categorie === this.filterCat;
      const matchRegion = !this.filterRegion || p.owner?.region === this.filterRegion;
      return matchSearch && matchCat && matchRegion;
    });
  }

  searchAI() {
    if (!this.aiQuery.trim()) return;
    this.aiLoading = true; this.aiError = ''; this.aiResults = null;
    this.api.searchShopWithAI(this.aiQuery).subscribe({
      next: r => { this.aiResults = r; this.aiLoading = false; },
      error: () => { this.aiError = 'Erreur IA. Réessayez.'; this.aiLoading = false; }
    });
  }

  clearAI() { this.aiResults = null; this.aiQuery = ''; this.aiError = ''; }

  openDetail(p: InventoryProduct) { this.selectedProduct = p; }
  closeDetail() { this.selectedProduct = null; }
  openCart()    { this.showCart = true; }
  closeCart()   { this.showCart = false; }
  openCheckout(){ this.showCart = false; this.showCheckout = true; }
  closeCheckout(){ this.showCheckout = false; }

  onPaymentSuccess() {
    this.showCheckout = false;
    this.selectedProduct = null;
      this.aiResults = null;
    this.loadShop();
  }

  vetName(p: InventoryProduct): string {
    return p.owner ? `${p.owner.prenom ?? ''} ${p.owner.nom ?? ''}`.trim() : 'Vétérinaire';
  }

  vetRegion(p: InventoryProduct): string {
    return p.owner?.region ?? '';
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

  get inStockCount() { return this.products.filter(p => (p.currentQuantity ?? 0) > 0).length; }
}
