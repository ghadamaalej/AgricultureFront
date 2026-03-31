import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { InventoryApiService } from '../../services/inventory-api.service';
import { StockMovement } from '../../models/inventory.models';

@Component({
  selector: 'app-movement-list',
  standalone: false,
  templateUrl: './movement-list.component.html',
  styleUrls: ['./movement-list.component.css']
})
export class MovementListComponent implements OnInit {
  @Output() back = new EventEmitter<void>();

  movements: StockMovement[] = [];
  loading = true;

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.api.getMyMovements().subscribe({
      next: m => { this.movements = m; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  typeLabel(t: string) {
    return { ENTREE: 'Entrée', SORTIE: 'Sortie', AJUSTEMENT: 'Ajustement' }[t] || t;
  }
  typeClass(t: string) {
    return { ENTREE: 'type-in', SORTIE: 'type-out', AJUSTEMENT: 'type-adj' }[t] || '';
  }
  reasonLabel(r: string) {
    const m: Record<string,string> = {
      ACHAT:'Achat', CONSOMMATION:'Consommation', PERTE:'Perte', VENTE:'Vente',
      PRODUIT_EXPIRE:'Expiré', VOL:'Vol', VACCINATION:'Vaccination', AJUSTEMENT:'Ajustement', AUTRE:'Autre'
    };
    return m[r] || r;
  }
}
