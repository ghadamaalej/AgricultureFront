import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register-extra',
  standalone: false,
  templateUrl: './register-extra.component.html',
  styleUrls: ['./register-extra.component.css']
  
})
export class RegisterExtraComponent implements OnInit {

  role = '';
  extraForm!: FormGroup;
  previewCin:   string | null = null;
  previewCert:  string | null = null;
  previewDoc:   string | null = null;
  previewComm:  string | null = null;

  // Role config
  roleConfig: Record<string, { label: string; fields: string[] }> = {
    Farmer: {
      label: 'Farmer',
      fields: ['region']
    },
    Transporter: {
    label: 'Transporter',
    fields: ['vehicleType', 'capacityKg', 'licensePlate']
    },
    AgriculturalExpert: {
      label: 'Agricultural Expert',
      fields: [ 'documentUrl']
    },
    Agent: {
    label: 'Agent',
    fields: ['agency', 'workCertificate', 'organizationLogo', 'description']
    },
    Veterinarian: {
      label: 'Veterinarian',
      fields: ['clinicAddress', 'clinicPhone', 'careerPresentation']
    },
    EventOrganizer: {
      label: 'Event Organizer',
      fields: ['organizationName', 'organizationLogo',
               'description','cin']
    }
  };

  get config() {
    return this.roleConfig[this.role] || { label: '', fields: [] };
  }

  has(field: string): boolean {
    return this.config.fields.includes(field);
  }

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.role = localStorage.getItem('signupRole') || '';

    if (!this.role) {
      this.router.navigate(['/']);
      return;
    }

    const controls: Record<string, FormControl> = {};
    const f = this.config.fields;

    if (f.includes('region'))              controls['region']              = new FormControl('', Validators.required);
    if (f.includes('vehicleType'))   controls['vehicleType']   = new FormControl('', Validators.required);
    if (f.includes('capacityKg'))    controls['capacityKg']    = new FormControl('', [Validators.required, Validators.min(1)]);
    if (f.includes('licensePlate'))  controls['licensePlate']  = new FormControl('', Validators.required);    
    if (f.includes('documentUrl'))         controls['documentUrl']         = new FormControl(null, Validators.required);
    if (f.includes('agency'))             controls['agency']              = new FormControl('', Validators.required);
    if (f.includes('workCertificate'))     controls['workCertificate']     = new FormControl(null, Validators.required);
    if (f.includes('clinicAddress'))       controls['clinicAddress']       = new FormControl('', Validators.required);
    if (f.includes('clinicPhone'))         controls['clinicPhone']         = new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]);
    if (f.includes('careerPresentation'))  controls['careerPresentation']  = new FormControl('', Validators.required);
    if (f.includes('organizationName'))    controls['organizationName']    = new FormControl('', Validators.required);
    if (f.includes('organizationLogo'))    controls['organizationLogo']    = new FormControl(null, Validators.required);
    if (f.includes('description'))         controls['description']         = new FormControl('', Validators.required);
    if (f.includes('cin'))                 controls['cin']                 = new FormControl(null, Validators.required);

    this.extraForm = new FormGroup(controls);
  }

  invalid(field: string): boolean {
    const c = this.extraForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  onFileChange(event: Event, field: string): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.extraForm.get(field)?.setValue(file);
    this.extraForm.get(field)?.markAsTouched();
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (field === 'cin')               this.previewCin  = result;
      if (field === 'workCertificate')   this.previewCert = result;
      if (field === 'documentUrl')       this.previewDoc  = result;
      if (field === 'organizationLogo')  this.previewComm = result;
    };
    reader.readAsDataURL(file);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  submit(): void {
    if (this.extraForm.invalid) { this.extraForm.markAllAsTouched(); return; }
    const base  = JSON.parse(localStorage.getItem('signupBase') || '{}');
    const extra = this.extraForm.value;
    const full  = { ...base, ...extra, role: this.role };
    console.log('Full registration:', full);
    localStorage.removeItem('signupBase');
    localStorage.removeItem('signupRole');
    // → send to API here
  }
}