import { Component, OnInit } from '@angular/core';
import { ServicePretService } from '../../../services/loans/service-pret.service';
import { Router } from '@angular/router';
import { FormGroup, FormControl, Validators, ReactiveFormsModule,AbstractControl,ValidationErrors, ValidatorFn } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './service-form.component.html',
  styleUrls: ['./service-form.component.css']
})
export class ServiceFormComponent implements OnInit {

  serviceForm!: FormGroup;

  successMessage: string = '';
  errorMessage: string = '';
  isEditMode = false;
  serviceId?: number;
  constructor(
    private serviceService: ServicePretService,
    private router: Router,
    private route: ActivatedRoute
    
  ) {}

  ngOnInit(): void {

    this.serviceForm = new FormGroup({
      nom: new FormControl('', [Validators.required, Validators.minLength(3)]),
      description: new FormControl('', [Validators.required, Validators.minLength(10)]),

      montantMin: new FormControl(0, [Validators.required, Validators.min(0)]),
      montantMax: new FormControl(0, [Validators.required, Validators.min(0)]),

      dureeMaxMois: new FormControl(0, [Validators.required, Validators.min(1)]),

      tauxInteret: new FormControl(0, [
        Validators.required,
        Validators.min(0),
        Validators.max(100)
      ]),

      tauxPenalite: new FormControl(0, [
        Validators.min(0),
        Validators.max(100)
      ]),

      criteresEligibilite: new FormControl('', Validators.required),
      documentsRequis: new FormControl('', Validators.required),
      delaiTraitement: new FormControl('', Validators.required)
    });

   
      this.serviceForm.setValidators(this.amountValidator());
      this.serviceForm.valueChanges.subscribe(() => {
      this.serviceForm.updateValueAndValidity({ emitEvent: false });

    });

      this.serviceId = this.route.snapshot.params['id'];

  if (this.serviceId) {
    this.isEditMode = true;

    this.serviceService.getById(this.serviceId).subscribe({
      next: (data) => {
        this.serviceForm.patchValue(data); 
      },
      error: () => {
        this.errorMessage = "Erreur chargement service";
      }
    });
  }
  }

 amountValidator(): ValidatorFn {
  return (formGroup: AbstractControl): ValidationErrors | null => {

    const min = formGroup.get('montantMin')?.value;
    const max = formGroup.get('montantMax')?.value;

    if (min != null && max != null && min > max) {
      return { amountError: true };
    }

    return null;
  };
}
  get f() {
    return this.serviceForm.controls;
  }
onCancel(): void {
  this.serviceForm.reset();
  this.router.navigate(['/loans/agent/services']);
}
  

onSubmit(): void {

  if (this.serviceForm.invalid || this.serviceForm.errors?.['amountError']) {
    this.serviceForm.markAllAsTouched();
    return;
  }

  const formData = {
  ...this.serviceForm.value,
  id: this.serviceId
};

  this.successMessage = '';
  this.errorMessage = '';

  // MODE EDIT
  if (this.isEditMode && this.serviceId) {

    this.serviceService.update(this.serviceId, formData).subscribe({
      next: () => {
        this.successMessage = "Service modified successfully";

        setTimeout(() => {
          this.router.navigate(['/loans/agent/services']);
        }, 1000);
      },
      error: () => {
        this.errorMessage = "Error during editing";
      }
    });

  } 
  // MODE CREATE
  else {

    this.serviceService.create(formData).subscribe({
      next: () => {
        this.successMessage = "Service added successfully";

        this.serviceForm.reset();

        this.serviceForm.patchValue({
          montantMin: 0,
          montantMax: 0,
          dureeMaxMois: 0,
          tauxInteret: 0,
          tauxPenalite: 0
        });

        setTimeout(() => {
          this.router.navigate(['/loans/agent/services']);
        }, 1000);
      },

      error: () => {
        this.errorMessage = "Error While adding service";
      }
    });
  }
}
}