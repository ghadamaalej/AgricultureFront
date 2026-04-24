import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AuthService } from '../../../services/auth/auth.service';

export interface FarmerUser {
  id: number;
  nom: string;
  prenom: string;
  photo: string | null;
  email: string;
  motDePasse?: string;
  telephone: string;
  region: string | null;
  cin: number | null;
}

@Component({
  selector: 'app-farmer-profile-form',
  standalone: false,
  templateUrl: './farmer-profile-form.component.html',
  styleUrls: ['./farmer-profile-form.component.css']
})
export class FarmerProfileFormComponent implements OnInit {
  loading = true;
  saving  = false;
  success = false;
  error   = '';
  farmer: FarmerUser | null = null;

  form = new FormGroup({
    nom:        new FormControl('', Validators.required),
    prenom:     new FormControl('', Validators.required),
    email:      new FormControl('', [Validators.required, Validators.email]),
    telephone:  new FormControl(''),
    region:     new FormControl(''),
    cin:        new FormControl<number | null>(null, [Validators.min(10000000), Validators.max(99999999)]),
    motDePasse: new FormControl(''),
  });

  constructor(private api: AppointmentsApiService, private auth: AuthService) {}

  ngOnInit() {
    const id = this.auth.getCurrentUserId()!;
    this.api.getVetById(id).subscribe({
      next: (u: any) => {
        this.farmer = u as FarmerUser;
        this.form.patchValue({
          nom:       u.nom,
          prenom:    u.prenom,
          email:     u.email,
          telephone: u.telephone,
          region:    u.region,
          cin:       u.cin ?? null,
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger le profil.';
      }
    });
  }

  submit() {
    if (this.form.invalid || !this.farmer) { this.form.markAllAsTouched(); return; }
    this.saving = true; this.success = false; this.error = '';

    const payload: any = { ...this.farmer, ...this.form.value };
    // Ne pas envoyer motDePasse si vide
    if (!payload.motDePasse) { delete payload.motDePasse; }

    this.api.updateVetProfile(payload).subscribe({
      next: () => { this.saving = false; this.success = true; },
      error: e => {
        this.saving = false;
        this.error = e.error?.message || 'Erreur lors de la sauvegarde.';
      }
    });
  }

  invalid(f: string) {
    const c = this.form.get(f);
    return c && c.invalid && c.touched;
  }

  get initials() {
    return `${this.farmer?.prenom?.charAt(0) || ''}${this.farmer?.nom?.charAt(0) || ''}`.toUpperCase();
  }
}