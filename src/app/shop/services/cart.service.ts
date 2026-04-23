import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InventoryProduct } from 'src/app/inventory/models/inventory.models';

export interface CartItem {
  product: InventoryProduct;
  quantity: number;
  vetNom: string;
  vetRegion: string;
  sousTotal: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly STORAGE_KEY = 'vet_cart';
  private itemsSubject = new BehaviorSubject<CartItem[]>(this.loadFromStorage());
  items$ = this.itemsSubject.asObservable();

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

  addItem(product: InventoryProduct, quantity: number, vetNom: string, vetRegion: string) {
    const current = [...this.items];
    const idx = current.findIndex(i => i.product.id === product.id);

    if (idx >= 0) {
      current[idx].quantity += quantity;
      current[idx].sousTotal = current[idx].quantity * (product.prixVente ?? 0);
    } else {
      current.push({
        product,
        quantity,
        vetNom,
        vetRegion,
        sousTotal: quantity * (product.prixVente ?? 0)
      });
    }
    this.save(current);
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
