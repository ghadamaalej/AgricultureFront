import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct } from '../../models/inventory.models';

@Component({
  selector: 'app-campaign-form',
  standalone: false,
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.css']
})
export class CampaignFormComponent implements OnInit {
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading      = false;
  loadingProds = true;
  error        = '';
  products: InventoryProduct[] = [];

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.form = new FormGroup({
      espece:      new FormControl('', Validators.required),
      ageMin:      new FormControl(null, [Validators.required, Validators.min(0)]),
      ageMax:      new FormControl(null, [Validators.required, Validators.min(0)]),
      plannedDate: new FormControl('', Validators.required),
      productId:   new FormControl(null, Validators.required),
      dose:        new FormControl(null, [Validators.required, Validators.min(0.01)]),
    });

    // Charger les produits vaccins de l'agriculteur
    this.api.getMyProducts().subscribe({
      next: prods => {
        this.products = prods.filter(p => p.categorie === 'VACCIN');
        this.loadingProds = false;
      },
      error: () => { this.loadingProds = false; }
    });
  }

  invalid(f: string) {
    const c = this.form.get(f);
    return c && c.invalid && c.touched;
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.error   = '';
    this.api.createCampaign(this.form.value).subscribe({
      next:  () => { this.loading = false; this.saved.emit(); },
      error: (e) => { this.loading = false; this.error = e.error?.message || 'Erreur serveur'; }
    });
  }
}
