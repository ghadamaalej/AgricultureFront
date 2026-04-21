import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { Animal, InventoryProduct } from '../../models/inventory.models';

@Component({
  selector: 'app-vaccination-modal',
  standalone: false,
  templateUrl: './vaccination-modal.component.html',
  styleUrls: ['./vaccination-modal.component.css']
})
export class VaccinationModalComponent implements OnInit {
  @Input() animal!: Animal;
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
      vaccinName:       new FormControl('', Validators.required),
      dateVaccination:  new FormControl('', Validators.required),
      nextDueDate:      new FormControl(''),
      note:             new FormControl(''),
      animalId:         new FormControl(this.animal.id),
    });

    this.api.getMyProducts().subscribe({
      next: p => { this.products = p.filter(x => x.categorie === 'VACCIN'); this.loadingProds = false; },
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
    this.api.scheduleAnimalVaccination(this.form.value).subscribe({
      next:  () => { this.loading = false; this.saved.emit(); },
      error: (e) => { this.loading = false; this.error = e.error?.message || 'Erreur serveur'; }
    });
  }
}
