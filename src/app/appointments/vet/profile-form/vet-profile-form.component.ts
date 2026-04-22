import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AuthService } from '../../../services/auth/auth.service';
import { VetUser } from '../../models/appointments.models';

@Component({
  selector: 'app-vet-profile-form',
  standalone: false,
  templateUrl: './vet-profile-form.component.html',
  styleUrls: ['./vet-profile-form.component.css']
})
export class VetProfileFormComponent implements OnInit {
  loading = true;
  saving  = false;
  success = false;
  error   = '';
  vet: VetUser | null = null;

  form = new FormGroup({
    nom:                  new FormControl('', Validators.required),
    prenom:               new FormControl('', Validators.required),
    email:                new FormControl('', [Validators.required, Validators.email]),
    telephone:            new FormControl(''),
    region:               new FormControl(''),
    adresseCabinet:       new FormControl(''),
    telephoneCabinet:     new FormControl(''),
    presentationCarriere: new FormControl(''),
  });

  constructor(private api: AppointmentsApiService, private auth: AuthService) {}

  ngOnInit() {
    const id = this.auth.getCurrentUserId()!;
    this.api.getVetById(id).subscribe({
      next: v => {
        this.vet = v;
        this.form.patchValue({
          nom: v.nom, prenom: v.prenom, email: v.email,
          telephone: v.telephone, region: v.region,
          adresseCabinet: v.adresseCabinet, telephoneCabinet: v.telephoneCabinet,
          presentationCarriere: v.presentationCarriere,
        });
        this.loading = false;
      },
      error: () => { this.loading = false; this.error = 'Impossible de charger le profil.'; }
    });
  }

  submit() {
    if (this.form.invalid || !this.vet) { this.form.markAllAsTouched(); return; }
    this.saving = true; this.success = false; this.error = '';
    this.api.updateVetProfile({ ...this.vet, ...this.form.value }).subscribe({
      next: () => { this.saving = false; this.success = true; },
      error: e => { this.saving = false; this.error = e.error?.message || 'Erreur lors de la sauvegarde.'; }
    });
  }

  invalid(f: string) { const c = this.form.get(f); return c && c.invalid && c.touched; }

  get initials() {
    return `${this.vet?.prenom?.charAt(0)||''}${this.vet?.nom?.charAt(0)||''}`.toUpperCase();
  }
}
