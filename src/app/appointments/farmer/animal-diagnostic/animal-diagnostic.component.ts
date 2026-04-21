import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { InventoryApiService } from '../../../inventory/services/inventory-api.service';
import { Animal } from '../../../inventory/models/inventory.models';
import { DiagnosticRequest, DiagnosticResponse } from '../../models/appointments.models';
import { AppointmentsApiService } from '../../services/appointments-api.service';

@Component({
  selector: 'app-animal-diagnostic',
  templateUrl: './animal-diagnostic.component.html',
  styleUrls: ['./animal-diagnostic.component.css']
})
export class AnimalDiagnosticComponent implements OnInit {
  animals: Animal[] = [];
  loadingAnimals = true;
  diagnosing = false;
  error = '';
  result: DiagnosticResponse | null = null;

  readonly form = this.fb.group({
    animalId: [null as number | null, Validators.required],
    symptom1: ['', Validators.required],
    symptom2: [''],
    symptom3: [''],
    duration: ['2 days', Validators.required],
    bodyTemperature: ['39.0C', Validators.required],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly inventoryApi: InventoryApiService,
    private readonly appointmentsApi: AppointmentsApiService
  ) {}

  ngOnInit(): void {
    this.inventoryApi.getMyAnimals().subscribe({
      next: animals => {
        this.animals = animals || [];
        this.loadingAnimals = false;
        if (this.animals.length === 1) {
          this.form.patchValue({ animalId: this.animals[0].id });
        }
      },
      error: () => {
        this.loadingAnimals = false;
        this.error = 'Impossible de charger vos animaux.';
      }
    });
  }

  submit(): void {
    this.error = '';
    this.result = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.diagnosing = true;
    this.appointmentsApi.diagnoseAnimal(this.buildPayload())
      .pipe(finalize(() => this.diagnosing = false))
      .subscribe({
        next: response => this.result = response,
        error: err => {
          this.error = err?.error?.message || 'Le diagnostic a echoue.';
        }
      });
  }

  quickFill(example: 'respiratory' | 'digestive' | 'skin'): void {
    if (example === 'respiratory') {
      this.form.patchValue({
        symptom1: 'depression',
        symptom2: 'coughing',
        symptom3: 'loss of appetite',
        duration: '3 days',
        bodyTemperature: '40.2C',
      });
      return;
    }

    if (example === 'digestive') {
      this.form.patchValue({
        symptom1: 'loss of appetite',
        symptom2: 'diarrhea',
        symptom3: 'dehydration',
        duration: '2 days',
        bodyTemperature: '39.4C',
      });
      return;
    }

    this.form.patchValue({
      symptom1: 'painless lumps',
      symptom2: 'swelling in limb',
      symptom3: 'depression',
      duration: '4 days',
      bodyTemperature: '39.8C',
    });
  }

  hasError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private buildPayload(question = ''): DiagnosticRequest {
    const value = this.form.getRawValue();
    return {
      animalId: value.animalId!,
      symptom1: value.symptom1!.trim(),
      symptom2: value.symptom2?.trim() || '',
      symptom3: value.symptom3?.trim() || '',
      duration: value.duration!.trim(),
      bodyTemperature: value.bodyTemperature!.trim(),
      question
    };
  }
}
