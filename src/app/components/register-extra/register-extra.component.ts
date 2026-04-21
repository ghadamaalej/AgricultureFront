import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, SignupStep2Request } from '../../services/auth/auth.service';

@Component({
  selector: 'app-register-extra',
  standalone: false,
  templateUrl: './register-extra.component.html',
  styleUrls: ['./register-extra.component.css']
  
})
export class RegisterExtraComponent implements OnInit {

  role = '';
  userId: number | null = null;
  baseSignup: Record<string, any> = {};
  extraForm!: FormGroup;
  previewCin:   string | null = null;
  previewCert:  string | null = null;
  previewDoc:   string | null = null;
  previewComm:  string | null = null;
  cinUploadUrl: string | null = null;
  certUploadUrl: string | null = null;
  docUploadUrl: string | null = null;
  commUploadUrl: string | null = null;
  isLoading = false;
  submitError = '';

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

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.role = localStorage.getItem('signupRole') || '';
    this.userId = Number(localStorage.getItem('signupUserId') || '0') || null;
    this.baseSignup = JSON.parse(localStorage.getItem('signupBase') || '{}');

    if (!this.role || this.userId == null) {
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

    const uploadUrl = this.buildMockFileUrl(file);
    if (field === 'cin') this.cinUploadUrl = uploadUrl;
    if (field === 'workCertificate') this.certUploadUrl = uploadUrl;
    if (field === 'documentUrl') this.docUploadUrl = uploadUrl;
    if (field === 'organizationLogo') this.commUploadUrl = uploadUrl;

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
    if (this.extraForm.invalid || this.userId == null) {
      this.extraForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.submitError = '';

    const payload = this.buildPayload();

    this.authService.signupStep2(this.userId, payload).subscribe({
      next: (response) => {
        this.isLoading = false;
        localStorage.setItem('authMode', 'verify');
        if (response.userId != null) {
          localStorage.setItem('pendingVerificationUserId', String(response.userId));
        }
        if (response.email) {
          localStorage.setItem('pendingVerificationEmail', response.email);
        }
        localStorage.setItem('pendingVerificationMessage', response.message || 'Please verify your email to continue.');
        localStorage.removeItem('signupBase');
        localStorage.removeItem('signupRole');
        localStorage.removeItem('signupUserId');
        localStorage.removeItem('signupEmail');
        localStorage.removeItem('signupMessage');
        this.router.navigate(['/auth']);
      },
      error: (err) => {
        this.isLoading = false;
        this.submitError = err.error?.message || 'Could not complete profile setup.';
      }
    });
  }

  private buildPayload(): SignupStep2Request {
    const value = this.extraForm.value;

    return {
      photo: this.baseSignup['photo'] ?? null,
      telephone: this.baseSignup['phone'] ?? null,
      region: value['region'] ?? null,
      diplomeExpert: this.docUploadUrl,
      documentUrl: this.docUploadUrl,
      vehicule: value['vehicleType'] ?? null,
      capacite: value['capacityKg'] != null ? Number(value['capacityKg']) : null,
      agence: value['agency'] ?? null,
      certificatTravail: this.certUploadUrl,
      organizationLogo: this.commUploadUrl,
      cin: this.cinUploadUrl,
      adresseCabinet: value['clinicAddress'] ?? null,
      presentationCarriere: value['careerPresentation'] ?? null,
      telephoneCabinet: value['clinicPhone'] ?? null,
      nomOrganisation: value['organizationName'] ?? null,
      description: value['description'] ?? null
    };
  }

  private buildMockFileUrl(file: File): string {
    const safeName = encodeURIComponent(file.name.replace(/\s+/g, '-'));
    return `https://files.greenroots.local/uploads/${Date.now()}-${safeName}`;
  }
}