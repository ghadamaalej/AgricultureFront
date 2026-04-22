import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { InventoryApiService } from '../../services/inventory-api.service';
import { Animal } from '../../models/inventory.models';

@Component({
  selector: 'app-animal-form',
  standalone: false,
  templateUrl: './animal-form.component.html',
  styleUrls: ['./animal-form.component.css']
})
export class AnimalFormComponent implements OnInit {
  @Input() animal: Animal | null = null;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading = false;
  error   = '';

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.form = new FormGroup({
      espece:        new FormControl(this.animal?.espece       || '', Validators.required),
      reference:     new FormControl(this.animal?.reference    || ''),
      poids:         new FormControl(this.animal?.poids        ?? null, [Validators.required, Validators.min(0.01)]),
      dateNaissance: new FormControl(this.animal?.dateNaissance || '', Validators.required),
    });
    this.form.get('reference')?.disable();
  }

  get isEdit() { return !!this.animal; }

  invalid(f: string) {
    const c = this.form.get(f);
    return c && c.invalid && c.touched;
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.error   = '';
    const val: any = this.form.getRawValue();
    delete val.reference;

    const obs = this.isEdit
      ? this.api.updateAnimal(this.animal!.id, val)
      : this.api.createAnimal(val);

    obs.subscribe({
      next:  () => { this.loading = false; this.saved.emit(); },
      error: (e) => { this.loading = false; this.error = e.error?.message || 'Erreur serveur'; }
    });
  }
}
