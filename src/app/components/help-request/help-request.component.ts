import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssistanceService, DemandeAssistance } from '../../services/assistance/assistance.service';

@Component({
  selector: 'app-help-request',
  templateUrl: './help-request.component.html',
  styleUrls: ['./help-request.component.css']
})
export class HelpRequestComponent implements OnInit {
  requestForm: FormGroup;
  isSubmitting = false;
  isLoadingHistory = false;
  errorMessage: string | null = null;
  historyErrorMessage: string | null = null;
  createdDemande: DemandeAssistance | null = null;
  previousDemandes: DemandeAssistance[] = [];

  problemTypes = [
    { value: 'MALADIE_PLANTE', label: 'Plant disease' },
    { value: 'MALADIE_ANIMALE', label: 'Animal health' },
    { value: 'IRRIGATION', label: 'Irrigation' },
    { value: 'FERTILISATION', label: 'Fertilization' },
    { value: 'CULTURE', label: 'Crop problem' },
    { value: 'ELEVAGE', label: 'Livestock' },
    { value: 'MATERIEL', label: 'Equipment' },
    { value: 'AUTRE', label: 'Other' }
  ];

  channels = [
    {
      value: 'IA',
      title: 'AI answer',
      description: 'Fast first suggestion for common farm problems.'
    },
    {
      value: 'MIXTE',
      title: 'AI + expert',
      description: 'Start with AI and keep the request open for follow-up.'
    },
    {
      value: 'INGENIEUR',
      title: 'Expert only',
      description: 'Send the request directly to an agricultural engineer.'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private assistanceService: AssistanceService,
    private router: Router
  ) {
    this.requestForm = this.fb.group({
      typeProbleme: ['MALADIE_PLANTE', Validators.required],
      canal: ['IA', Validators.required],
      description: ['', [Validators.required, Validators.minLength(12)]],
      localisation: [''],
      mediaUrl: ['']
    });
  }

  ngOnInit(): void {
    this.loadPreviousDemandes();
  }

  submitRequest(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    this.createdDemande = null;

    const payload: DemandeAssistance = {
      ...this.requestForm.value,
      userId: this.getCurrentUserId()
    };

    this.assistanceService.createDemande(payload).subscribe({
      next: (demande) => {
        this.createdDemande = demande;
        this.isSubmitting = false;
        this.loadPreviousDemandes();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Could not send your help request. Please try again.';
        this.isSubmitting = false;
      }
    });
  }

  viewDetails(): void {
    if (this.createdDemande?.idDemande) {
      this.router.navigate(['/assistance', this.createdDemande.idDemande]);
    }
  }

  openRequest(demande: DemandeAssistance): void {
    if (demande.idDemande) {
      this.router.navigate(['/assistance', demande.idDemande]);
    }
  }

  refreshPreviousDemandes(): void {
    this.loadPreviousDemandes();
  }

  confidencePercent(value: number | undefined): number {
    return Math.round((value || 0) * 100);
  }

  pendingMessage(): string {
    if (this.createdDemande?.canal === 'INGENIEUR') {
      return 'The request was created. AI response is not available yet, or this request is routed to an expert.';
    }

    if (this.createdDemande?.canal === 'MIXTE') {
      return 'The request was created. AI response is not available yet, and this request is also routed to an expert.';
    }

    return 'The request was created. AI response is not available yet.';
  }

  getLatestExpertResponse(demande: DemandeAssistance): string | null {
    const responses = demande.affectationDemande?.reponsesIngenieur || [];
    if (!responses.length) {
      return null;
    }

    return responses[responses.length - 1].contenu;
  }

  hasAnyResponse(demande: DemandeAssistance): boolean {
    return !!demande.reponseIA || !!this.getLatestExpertResponse(demande);
  }

  historyPendingMessage(demande: DemandeAssistance): string {
    if (demande.canal === 'INGENIEUR') {
      return 'Waiting for expert response.';
    }

    if (demande.canal === 'MIXTE') {
      return 'Waiting for AI or expert response.';
    }

    return 'Waiting for AI response.';
  }

  selectChannel(channel: string): void {
    this.requestForm.patchValue({ canal: channel });
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.requestForm.get(fieldName);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  private getCurrentUserId(): number | undefined {
    const storedUser = localStorage.getItem('authUser');
    if (!storedUser) {
      return undefined;
    }

    try {
      const user = JSON.parse(storedUser);
      return user?.userId || user?.id || user?.idUser;
    } catch {
      return undefined;
    }
  }

  private loadPreviousDemandes(): void {
    const userId = this.getCurrentUserId();
    if (!userId) {
      this.previousDemandes = [];
      return;
    }

    this.isLoadingHistory = true;
    this.historyErrorMessage = null;
    this.assistanceService.getDemandesByUserId(userId).subscribe({
      next: (demandes) => {
        this.previousDemandes = (demandes || []).sort((a, b) =>
          new Date(b.dateCreation || 0).getTime() - new Date(a.dateCreation || 0).getTime()
        );
        this.isLoadingHistory = false;
      },
      error: (error) => {
        this.historyErrorMessage = error?.error?.message || 'Could not load previous requests.';
        this.isLoadingHistory = false;
      }
    });
  }
}
