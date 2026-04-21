import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AppointmentResponse, HealthRecord, AnimalSummary, MedicalAssistantResponse } from '../../models/appointments.models';
import { AuthService } from '../../../services/auth/auth.service';

interface AnimalWithRecords {
  animal: AnimalSummary;
  farmerId: number | null;
  farmerName: string;
  records: HealthRecord[];
  expanded: boolean;
}

@Component({
  selector: 'app-health-records',
  standalone: false,
  templateUrl: './health-records.component.html',
  styleUrls: ['./health-records.component.css']
})
export class HealthRecordsComponent implements OnInit {
  // All accepted appointments → unique animals
  animalsWithRecords: AnimalWithRecords[] = [];
  loading = true;
  error   = '';

  // Selected animal for full view
  selectedAnimal: AnimalWithRecords | null = null;

  // Form state
  showForm   = false;
  editRecord: HealthRecord | null = null;
  formLoading = false;
  formError   = '';
  assistantQuestion = '';
  assistantLoading = false;
  assistantError = '';
  assistantResponse: MedicalAssistantResponse | null = null;
  suggestedQuestions = [
    'Fais un resume du dossier medical de cet animal.',
    'Quelle est la derniere maladie enregistree ?',
    'Quels traitements ont deja ete prescrits ?',
    'Y a-t-il des antecedents medicaux importants ?'
  ];

  form = new FormGroup({
    maladie:    new FormControl('', Validators.required),
    traitement: new FormControl('', Validators.required),
    dateH:      new FormControl('', Validators.required),
  });

  // Search
  searchTerm = '';
  filtered: AnimalWithRecords[] = [];

  constructor(private api: AppointmentsApiService, private auth: AuthService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const vetId = this.auth.getCurrentUserId()!;

    this.api.getVetAppointments(vetId).subscribe({
      next: (appts: AppointmentResponse[]) => {
        // Keep only ACCEPTEE appointments with an animal
        const accepted = appts.filter(a =>
          a.appointmentStatus === 'ACCEPTEE' && a.animal
        );

        // Deduplicate by animalId
        const map = new Map<number, AnimalWithRecords>();
        for (const appt of accepted) {
          const a = appt.animal!;
          if (!map.has(a.id)) {
            map.set(a.id, {
              animal: a,
              farmerId: appt.farmer?.id ?? null,
              farmerName: appt.farmer
                ? `${appt.farmer.prenom} ${appt.farmer.nom}`
                : 'Agriculteur inconnu',
              records: [],
              expanded: false,
            });
          }
        }

        this.animalsWithRecords = Array.from(map.values());
        this.filtered = [...this.animalsWithRecords];

        // Load records for each animal
        let remaining = this.animalsWithRecords.length;
        if (remaining === 0) { this.loading = false; return; }

        for (const item of this.animalsWithRecords) {
          this.api.getHealthRecordsByAnimal(item.animal.id).subscribe({
            next: records => {
              item.records = records;
              remaining--;
              if (remaining === 0) this.loading = false;
            },
            error: () => {
              remaining--;
              if (remaining === 0) this.loading = false;
            }
          });
        }
      },
      error: e => {
        this.loading = false;
        this.error = e.status === 0 ? 'Serveur inaccessible.' : 'Erreur de chargement';
      }
    });
  }

  search() {
    const t = this.searchTerm.toLowerCase().trim();
    if (!t) { this.filtered = this.animalsWithRecords; return; }
    this.filtered = this.animalsWithRecords.filter(item =>
      item.animal.reference.toLowerCase().includes(t) ||
      item.animal.espece.toLowerCase().includes(t) ||
      item.farmerName.toLowerCase().includes(t)
    );
  }

  selectAnimal(item: AnimalWithRecords) {
    this.selectedAnimal = item;
    this.showForm = false;
    this.editRecord = null;
    this.form.reset();
    this.assistantQuestion = '';
    this.assistantError = '';
    this.assistantResponse = null;
  }

  backToList() {
    this.selectedAnimal = null;
    this.showForm = false;
    this.editRecord = null;
    this.assistantQuestion = '';
    this.assistantError = '';
    this.assistantResponse = null;
  }

  openCreate() {
    this.editRecord = null;
    this.form.reset({ dateH: new Date().toISOString().split('T')[0] });
    this.showForm = true;
    this.formError = '';
  }

  openEdit(rec: HealthRecord) {
    this.editRecord = rec;
    this.form.patchValue({
      maladie:    rec.maladie,
      traitement: rec.traitement,
      dateH:      rec.dateH ? rec.dateH.substring(0, 10) : '',
    });
    this.showForm = true;
    this.formError = '';
  }

  cancelForm() { this.showForm = false; this.editRecord = null; this.form.reset(); }

  submitForm() {
    if (this.form.invalid || !this.selectedAnimal) { this.form.markAllAsTouched(); return; }
    this.formLoading = true;
    this.formError   = '';
    const v = this.form.value;

    const obs = this.editRecord
      ? this.api.updateHealthRecord(this.editRecord.id, {
          maladie: v.maladie!, traitement: v.traitement!, dateH: v.dateH!
        })
      : this.api.createHealthRecord({
          maladie: v.maladie!, traitement: v.traitement!, dateH: v.dateH!,
          animalId: this.selectedAnimal.animal.id
        });

    obs.subscribe({
      next: () => {
        this.formLoading = false;
        this.cancelForm();
        this.reloadAnimalRecords();
      },
      error: e => {
        this.formLoading = false;
        this.formError = e.error?.message || 'Erreur lors de la sauvegarde';
      }
    });
  }

  deleteRecord(rec: HealthRecord) {
    if (!confirm(`Supprimer ce dossier médical (${rec.maladie}) ?`)) return;
    this.api.deleteHealthRecord(rec.id).subscribe({
      next: () => this.reloadAnimalRecords()
    });
  }

  reloadAnimalRecords() {
    if (!this.selectedAnimal) return;
    this.api.getHealthRecordsByAnimal(this.selectedAnimal.animal.id).subscribe({
      next: records => { this.selectedAnimal!.records = records; }
    });
  }

  askAssistant(question?: string) {
    if (!this.selectedAnimal) return;

    const q = (question ?? this.assistantQuestion).trim();
    if (!q) {
      this.assistantError = 'Veuillez saisir une question.';
      return;
    }

    this.assistantQuestion = q;
    this.assistantLoading = true;
    this.assistantError = '';

    this.api.askMedicalAssistant(this.selectedAnimal.animal.id, { question: q }).subscribe({
      next: response => {
        this.assistantResponse = response;
        this.assistantLoading = false;
      },
      error: e => {
        this.assistantLoading = false;
        this.assistantError = e.error?.message || 'Le chatbot medical est indisponible.';
      }
    });
  }

  invalid(f: string) { const c = this.form.get(f); return c && c.invalid && c.touched; }

  age(dateNaissance: string): number {
    const born = new Date(dateNaissance);
    return Math.floor((Date.now() - born.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }
}