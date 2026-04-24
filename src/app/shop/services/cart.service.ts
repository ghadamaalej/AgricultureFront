import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InventoryProduct } from 'src/app/inventory/models/inventory.models';

export interface CartItem {
  product: InventoryProduct;
  quantity: number;
  vetId: number;
  vetNom: string;
  vetRegion: string;
  sousTotal: number;
}

export interface CartConflict {
  currentVetNom: string;
  newProduct: InventoryProduct;
  newQuantity: number;
  newVetId: number;
  newVetNom: string;
  newVetRegion: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly STORAGE_KEY = 'vet_cart';
  private itemsSubject = new BehaviorSubject<CartItem[]>(this.loadFromStorage());
  items$ = this.itemsSubject.asObservable();

  /** null = pas de conflit ; non-null = en attente de décision utilisateur */
  private conflictSubject = new BehaviorSubject<CartConflict | null>(null);
  conflict$ = this.conflictSubject.asObservable();

  private loadFromStorage(): CartItem[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private save(items: CartItem[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    this.itemsSubject.next(items);
  }

  get items(): CartItem[] { return this.itemsSubject.value; }

  get total(): number {
    return this.items.reduce((s, i) => s + i.sousTotal, 0);
  }

  get count(): number {
    return this.items.reduce((s, i) => s + i.quantity, 0);
  }

  /** ID du vétérinaire dont les produits sont déjà dans le panier (null si vide) */
  get currentVetId(): number | null {
    return this.items.length > 0 ? this.items[0].vetId : null;
  }

  get currentVetNom(): string {
    return this.items.length > 0 ? this.items[0].vetNom : '';
  }

  /**
   * Tente d'ajouter un produit.
   * - Si le panier est vide ou même vétérinaire → ajout direct, retourne true.
   * - Si vétérinaire différent → déclenche un conflit, retourne false.
   */
  addItem(
    product: InventoryProduct,
    quantity: number,
    vetId: number,
    vetNom: string,
    vetRegion: string
  ): boolean {
    const currentVet = this.currentVetId;

    if (currentVet !== null && currentVet !== vetId) {
      // Conflit : vétérinaire différent
      this.conflictSubject.next({
        currentVetNom: this.currentVetNom,
        newProduct: product,
        newQuantity: quantity,
        newVetId: vetId,
        newVetNom: vetNom,
        newVetRegion: vetRegion,
      });
      return false;
    }

    this._doAdd(product, quantity, vetId, vetNom, vetRegion);
    return true;
  }

  private _doAdd(
    product: InventoryProduct,
    quantity: number,
    vetId: number,
    vetNom: string,
    vetRegion: string
  ) {
    const current = [...this.items];
    const idx = current.findIndex(i => i.product.id === product.id);

    if (idx >= 0) {
      current[idx].quantity += quantity;
      current[idx].sousTotal = current[idx].quantity * (product.prixVente ?? 0);
    } else {
      current.push({
        product,
        quantity,
        vetId,
        vetNom,
        vetRegion,
        sousTotal: quantity * (product.prixVente ?? 0),
      });
    }
    this.save(current);
  }

  /** Appelé quand l'utilisateur accepte de vider le panier et reprendre avec le nouveau vétérinaire */
  resolveConflictReplace() {
    const c = this.conflictSubject.value;
    if (!c) return;
    this.save([]);
    this._doAdd(c.newProduct, c.newQuantity, c.newVetId, c.newVetNom, c.newVetRegion);
    this.conflictSubject.next(null);
  }

  /** Appelé quand l'utilisateur annule et garde le panier actuel */
  resolveConflictKeep() {
    this.conflictSubject.next(null);
  }

  updateQuantity(productId: number, quantity: number) {
    const current = [...this.items];
    const idx = current.findIndex(i => i.product.id === productId);
    if (idx < 0) return;
    if (quantity <= 0) {
      current.splice(idx, 1);
    } else {
      current[idx].quantity = quantity;
      current[idx].sousTotal = quantity * (current[idx].product.prixVente ?? 0);
    }
    this.save(current);
  }

  removeItem(productId: number) {
    this.save(this.items.filter(i => i.product.id !== productId));
  }

  clear() { this.save([]); }

  isInCart(productId: number): boolean {
    return this.items.some(i => i.product.id === productId);
  }

  getQuantity(productId: number): number {
    return this.items.find(i => i.product.id === productId)?.quantity ?? 0;
  }
}
