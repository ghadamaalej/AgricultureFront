import { Component } from '@angular/core';
import { CartService, CartConflict } from '../../services/cart.service';

@Component({
  selector: 'app-cart-conflict',
  standalone: false,
  template: `
<ng-container *ngIf="cartService.conflict$ | async as conflict">
  <div class="conflict-backdrop" (click)="keep()"></div>
  <div class="conflict-modal">
    <div class="conflict-icon">🛒⚠️</div>
    <h3 class="conflict-title">Produits de vétérinaires différents</h3>
    <p class="conflict-body">
      Votre panier contient déjà des produits du
      <strong>Dr. {{ conflict.currentVetNom }}</strong>.<br>
      Vous ne pouvez pas mélanger des produits de plusieurs vétérinaires dans une même commande.
    </p>
    <p class="conflict-question">
      Voulez-vous vider le panier actuel et commencer une nouvelle commande avec
      <strong>Dr. {{ conflict.newVetNom }}</strong> ?
    </p>
    <div class="conflict-actions">
      <button class="btn-keep" (click)="keep()">
        <i class="fas fa-arrow-left"></i> Garder le panier actuel
      </button>
      <button class="btn-replace" (click)="replace()">
        <i class="fas fa-trash-alt"></i> Vider et recommencer
      </button>
    </div>
  </div>
</ng-container>
  `,
  styleUrls: ['./cart-conflict.component.css']
})
export class CartConflictComponent {
  constructor(public cartService: CartService) {}
  keep()    { this.cartService.resolveConflictKeep(); }
  replace() { this.cartService.resolveConflictReplace(); }
}
