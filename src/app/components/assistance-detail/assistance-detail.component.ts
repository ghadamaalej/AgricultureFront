import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssistanceService, DemandeAssistance, ReponseIA, ReponseIngenieur } from '../../services/assistance/assistance.service';

@Component({
  selector: 'app-assistance-detail',
  templateUrl: './assistance-detail.component.html',
  styleUrls: ['./assistance-detail.component.css']
})
export class AssistanceDetailComponent implements OnInit {
  demande: DemandeAssistance | null = null;
  isLoading = false;
  isGenerating = false;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private assistanceService: AssistanceService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage = 'Invalid assistance request id.';
      return;
    }

    this.loadDemande(id);
  }

  loadDemande(id: number): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.assistanceService.getDemandeById(id).subscribe({
      next: (demande) => {
        this.demande = demande;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load the assistance request.';
        this.isLoading = false;
      }
    });
  }

  generateAIResponse(): void {
    if (!this.demande?.idDemande || this.demande.reponseIA) {
      return;
    }

    this.isGenerating = true;
    this.errorMessage = null;

    this.assistanceService.generateAIResponse(this.demande.idDemande).subscribe({
      next: (response) => {
        this.applyGeneratedResponse(response);
        this.isGenerating = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to generate the AI response.';
        this.isGenerating = false;
      }
    });
  }

  confidencePercent(probabilite: number | undefined): number {
    return Math.round((probabilite || 0) * 100);
  }

  canGenerateAI(): boolean {
    return !!this.demande && !this.demande.reponseIA && this.demande.canal !== 'INGENIEUR';
  }

  getEngineerResponses(): ReponseIngenieur[] {
    return this.demande?.affectationDemande?.reponsesIngenieur || [];
  }

  hasEngineerResponses(): boolean {
    return this.getEngineerResponses().length > 0;
  }

  private applyGeneratedResponse(response: ReponseIA): void {
    if (!this.demande) {
      return;
    }

    this.demande = {
      ...this.demande,
      statut: 'EN_COURS',
      reponseIA: response
    };
  }
}
