import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ServicePretService } from '../../../services/loans/service-pret.service';
import { DemandePretService } from '../../../services/loans/demande-pret.service';
import { AuthService } from '../../../services/auth/auth.service';
import { Demande, StatutDemande } from '../../models/demande';

@Component({
  selector: 'app-demande-pret-form',
  standalone: false,
  templateUrl: './demande-pret-form.component.html',
  styleUrl: './demande-pret-form.component.css'
})
export class DemandePretFormComponent implements OnInit {

  form!: FormGroup;
  serviceId!: number;
  service: any;

  showRecap = false;
  mensualite = 0;
  submitted = false;
  isLoading = false;
  errorMessage: string | null = null;
  uploadedFiles: File[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private serviceService: ServicePretService,
    private demandeService: DemandePretService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.serviceId = Number(this.route.snapshot.paramMap.get('id'));

    this.form = this.fb.group({
      montantDemande: ['', [Validators.required]],
      dureeMois:      ['', [Validators.required]],
      objet:          ['', [Validators.required, Validators.minLength(5)]]
    });

    this.serviceService.getById(this.serviceId).subscribe(data => {
      this.service = data;
      this.setValidators();
    });
  }

  setValidators() {
    if (!this.service) return;

    this.form.get('montantDemande')?.setValidators([
      Validators.required,
      Validators.min(this.service.montantMin ?? 0),
      Validators.max(this.service.montantMax)
    ]);

    this.form.get('dureeMois')?.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(this.service.dureeMaxMois)
    ]);

    this.form.get('montantDemande')?.updateValueAndValidity();
    this.form.get('dureeMois')?.updateValueAndValidity();
  }

  updateRecap() {
    const m = +this.form.get('montantDemande')?.value;
    const d = +this.form.get('dureeMois')?.value;
    const o = this.form.get('objet')?.value?.trim();

    const montantOk = m >= (this.service?.montantMin ?? 0) && m <= (this.service?.montantMax ?? 0);
    const dureeOk   = d >= 1 && d <= (this.service?.dureeMaxMois ?? 0);
    const objetOk   = o?.length >= 5;

    if (montantOk && dureeOk && objetOk) {
      this.mensualite = (m * (1 + 0.05 * d / 12)) / d;
      this.showRecap = true;
    } else {
      this.showRecap = false;
    }
  }

  submit() {
    if (this.form.invalid) return;

    const agriculteurId = this.authService.getCurrentUserId();
    if (!agriculteurId) {
      this.errorMessage = 'Vous devez être connecté pour soumettre une demande.';
      return;
    }

    const today = new Date();
    const dateDemande = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const demande: Demande = {
      montantDemande:   this.form.value.montantDemande,
      dureeMois:        this.form.value.dureeMois,
      objet:            this.form.value.objet,
      service:          { id: this.serviceId },
      agriculteurId: agriculteurId,
      statut:           'EN_ATTENTE' as StatutDemande,
      dateDemande:      dateDemande,
      scoreSolvabilite: 0,
      documents:        []
    };

    this.isLoading = true;
    this.errorMessage = null;

    // ── Étape 1 : créer la demande ──────────────────────
    this.demandeService.createDemande(demande).subscribe({
      next: (response) => {
        const demandeId = response.id;

        // ── Vérification id ─────────────────────────────
        if (!demandeId) {
          this.isLoading = false;
          this.errorMessage = 'Erreur : ID demande manquant.';
          return;
        }

        // ── Étape 2 : upload fichiers si présents ───────
        if (this.uploadedFiles.length > 0) {
          const formData = new FormData();
          this.uploadedFiles.forEach(file => {
            formData.append('files', file, file.name);
          });

          this.demandeService.uploadDocuments(demandeId, formData).subscribe({
            next: () => {
              this.isLoading = false;
              this.naviguerApresSucces();
            },
            error: (err) => {
              // Demande créée mais upload échoué — on navigue quand même
              console.error('Upload docs échoué:', err);
              this.isLoading = false;
              this.naviguerApresSucces();
            }
          });

        } else {
          // Pas de fichiers — naviguer directement
          this.isLoading = false;
          this.naviguerApresSucces();
        }
      },
      error: (err) => {
        console.error('Status:', err.status);
        console.error('Error body:', JSON.stringify(err.error));
        this.isLoading = false;
        this.errorMessage = 'Erreur : ' + (err.error?.message || 'Veuillez réessayer.');
      }
    });
  }

  // ── Navigation après succès ─────────────────────────
  private naviguerApresSucces() {
    this.submitted = true;
    setTimeout(() => {
      this.router.navigate(['/loans/institutions']);
    }, 2000);
  }

  // ── Documents ───────────────────────────────────────
  getDocumentsList(): string[] {
    if (!this.service?.documentsRequis) return [];
    return this.service.documentsRequis
      .split(/\n|(?=-)/)
      .map((d: string) => d.replace(/^-\s*/, '').trim())
      .filter((d: string) => d.length > 0);
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      Array.from(input.files).forEach(file => {
        if (!this.uploadedFiles.find(f => f.name === file.name)) {
          this.uploadedFiles.push(file);
        }
      });
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      Array.from(event.dataTransfer.files).forEach(file => {
        if (!this.uploadedFiles.find(f => f.name === file.name)) {
          this.uploadedFiles.push(file);
        }
      });
    }
  }

  removeFile(index: number) {
    this.uploadedFiles.splice(index, 1);
  }
}