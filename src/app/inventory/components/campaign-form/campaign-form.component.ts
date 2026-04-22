import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { InventoryProduct, Animal } from '../../models/inventory.models';

@Component({
  selector: 'app-campaign-form',
  standalone: false,
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.css']
})
export class CampaignFormComponent implements OnInit {
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading = false;
  loadingProds = true;
  loadingSpecies = true;
  error = '';

  products: InventoryProduct[] = [];
  animals: Animal[] = [];
  speciesOptions: string[] = [];

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.form = new FormGroup({
      espece: new FormControl('', Validators.required),
      ageMin: new FormControl(0, [Validators.required, Validators.min(0)]),
      ageMax: new FormControl(10, [Validators.required, Validators.min(0)]),
      plannedDate: new FormControl('', Validators.required),
      productId: new FormControl(null, Validators.required),
      dose: new FormControl(null, [Validators.required, Validators.min(0.01)]),
    });

    this.loadProducts();
    this.loadSpecies();
  }

  loadProducts() {
    this.loadingProds = true;

    this.api.getMyProducts().subscribe({
      next: (prods) => {
        this.products = prods.filter(p => p.categorie === 'VACCIN');
        this.loadingProds = false;
      },
      error: () => {
        this.loadingProds = false;
      }
    });
  }

  loadSpecies() {
    this.loadingSpecies = true;

    this.api.getMyAnimals().subscribe({
      next: (animals) => {
        this.animals = animals;

        this.speciesOptions = [...new Set(
          animals
            .map(a => (a.espece || '').trim())
            .filter(espece => espece.length > 0)
        )].sort((a, b) => a.localeCompare(b));

        this.loadingSpecies = false;
      },
      error: () => {
        this.loadingSpecies = false;
      }
    });
  }

  invalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && c.touched);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();

    if (Number(val.ageMin) > Number(val.ageMax)) {
      this.error = "L'âge minimum doit être inférieur ou égal à l'âge maximum.";
      return;
    }

    this.loading = true;
    this.error = '';

    const req = {
      espece: val.espece,
      ageMin: Number(val.ageMin),
      ageMax: Number(val.ageMax),
      plannedDate: val.plannedDate,
      productId: Number(val.productId),
      dose: Number(val.dose)
    };

    this.api.createCampaign(req).subscribe({
      next: () => {
        this.loading = false;
        this.saved.emit();
      },
      error: (e) => {
        this.loading = false;
        this.error = e.error?.message || 'Erreur serveur';
      }
    });
  }
}