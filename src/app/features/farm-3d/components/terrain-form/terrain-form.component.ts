import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Terrain } from '../../models/terrain.model';

@Component({
  selector: 'app-terrain-form',
  standalone: false,
  templateUrl: './terrain-form.component.html',
  styleUrls: ['./terrain-form.component.css']
})
export class TerrainFormComponent {
  @Output() terrainCreated = new EventEmitter<Terrain>();

  terrainForm: FormGroup;
  isSubmitting = false;

  soilTypes = [
    { label: 'Argileux', value: 'ARGILEUX' },
    { label: 'Sableux', value: 'SABLEUX' },
    { label: 'Limoneux', value: 'LIMONEUX' },
    { label: 'Calcaire', value: 'CALCAIRE' },
    { label: 'Humifère', value: 'HUMIFERE' },
    { label: 'Silico-argileux', value: 'SILICO_ARGILEUX' },
    { label: 'Salin', value: 'SALIN' },
    { label: 'Autre', value: 'AUTRE' }
  ];

  irrigationTypes = [
    { label: 'Goutte à goutte', value: 'GOUTTE_A_GOUTTE' },
    { label: 'Aspersion', value: 'ASPERSION' },
    { label: 'Inondation', value: 'INONDATION' },
    { label: 'Pluvial', value: 'PLUVIAL' },
    { label: 'Autre', value: 'AUTRE' }
  ];

  waterSources = [
    'Puits',
    'Rivière',
    'Lac',
    'Réseau municipal',
    'Eau de pluie',
    'Autre'
  ];

  constructor(private fb: FormBuilder) {
    this.terrainForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      superficieHa: ['', [Validators.required, Validators.min(0.01), Validators.max(10000)]],
      localisation: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      latitude: ['', [Validators.required, Validators.min(-90), Validators.max(90)]],
      longitude: ['', [Validators.required, Validators.min(-180), Validators.max(180)]],
      typeSol: ['', Validators.required],
      irrigation: ['', Validators.required],
      sourceEau: ['', Validators.required],
      remarque: ['', Validators.maxLength(500)],
      userId: [1, Validators.required] // TODO: Get from auth service
    });
  }

  onSubmit() {
    if (this.terrainForm.valid) {
      this.isSubmitting = true;
      const terrain: Terrain = this.terrainForm.value;
      this.terrainCreated.emit(terrain);

      // Reset form after successful submission
      this.terrainForm.reset({
        typeSol: '',
        irrigation: '',
        sourceEau: '',
        userId: 1
      });
      this.isSubmitting = false;
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.terrainForm.controls).forEach(key => {
      const control = this.terrainForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.terrainForm.get(fieldName);
    if (control?.hasError('required')) {
      return 'Ce champ est obligatoire';
    }
    if (control?.hasError('minlength')) {
      return `Minimum ${control.errors?.['minlength'].requiredLength} caractères`;
    }
    if (control?.hasError('maxlength')) {
      return `Maximum ${control.errors?.['maxlength'].requiredLength} caractères`;
    }
    if (control?.hasError('min')) {
      return `Valeur minimum: ${control.errors?.['min'].min}`;
    }
    if (control?.hasError('max')) {
      return `Valeur maximum: ${control.errors?.['max'].max}`;
    }
    return '';
  }
}