import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AssistanceService, DemandeAssistance } from '../../services/assistance/assistance.service';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-expert-assistance-requests',
  templateUrl: './expert-assistance-requests.component.html',
  styleUrls: ['./expert-assistance-requests.component.css']
})
export class ExpertAssistanceRequestsComponent implements OnInit {
  demandes: DemandeAssistance[] = [];
  filteredDemandes: DemandeAssistance[] = [];
  selectedStatus = 'ALL';
  isLoading = false;
  actionInProgressId: number | null = null;
  responseInProgressId: number | null = null;
  errorMessage: string | null = null;
  currentExpertId: number | null = null;
  responseTextByAffectation: Record<number, string> = {};

  statusFilters = [
    { value: 'ALL', label: 'All expert requests' },
    { value: 'EN_ATTENTE_INGENIEUR', label: 'Waiting engineer' },
    { value: 'EN_COURS', label: 'In progress' },
    { value: 'RESOLUE', label: 'Resolved' }
  ];

  constructor(
    private assistanceService: AssistanceService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentExpertId = this.authService.getCurrentUserId();
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.assistanceService.getAllDemandes().subscribe({
      next: (demandes) => {
        this.demandes = (demandes || []).filter((demande) => this.isForExpert(demande));
        this.applyFilter();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load assistance requests.';
        this.isLoading = false;
      }
    });
  }

  applyFilter(): void {
    if (this.selectedStatus === 'ALL') {
      this.filteredDemandes = this.demandes;
      return;
    }

    this.filteredDemandes = this.demandes.filter((demande) => demande.statut === this.selectedStatus);
  }

  openDetails(demande: DemandeAssistance): void {
    if (demande.idDemande) {
      this.router.navigate(['/assistance', demande.idDemande]);
    }
  }

  accept(demande: DemandeAssistance): void {
    const affectationId = demande.affectationDemande?.idAffectation;
    if (!affectationId || !this.currentExpertId) {
      return;
    }

    this.actionInProgressId = affectationId;
    this.errorMessage = null;
    this.assistanceService.acceptAffectation(affectationId, this.currentExpertId).subscribe({
      next: () => {
        this.actionInProgressId = null;
        this.loadRequests();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to accept this request.';
        this.actionInProgressId = null;
      }
    });
  }

  refuse(demande: DemandeAssistance): void {
    const affectationId = demande.affectationDemande?.idAffectation;
    if (!affectationId || !this.currentExpertId) {
      return;
    }

    this.actionInProgressId = affectationId;
    this.errorMessage = null;
    this.assistanceService.refuseAffectation(affectationId, this.currentExpertId).subscribe({
      next: () => {
        this.actionInProgressId = null;
        this.loadRequests();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to refuse this request.';
        this.actionInProgressId = null;
      }
    });
  }

  submitResponse(demande: DemandeAssistance): void {
    const affectationId = demande.affectationDemande?.idAffectation;
    const contenu = affectationId ? this.responseTextByAffectation[affectationId]?.trim() : '';
    if (!affectationId || !contenu || !this.canRespond(demande)) {
      return;
    }

    this.responseInProgressId = affectationId;
    this.errorMessage = null;
    this.assistanceService.createEngineerResponse(affectationId, contenu).subscribe({
      next: () => {
        this.responseTextByAffectation[affectationId] = '';
        this.responseInProgressId = null;
        this.loadRequests();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to send this response.';
        this.responseInProgressId = null;
      }
    });
  }

  canDecide(demande: DemandeAssistance): boolean {
    return demande.affectationDemande?.statut === 'ENVOYEE'
      && (
        demande.affectationDemande?.ingenieurId === this.currentExpertId
        || !demande.affectationDemande?.ingenieurId
      );
  }

  canRefuse(demande: DemandeAssistance): boolean {
    return demande.affectationDemande?.statut === 'ENVOYEE'
      && demande.affectationDemande?.ingenieurId === this.currentExpertId;
  }

  canRespond(demande: DemandeAssistance): boolean {
    return demande.affectationDemande?.statut === 'ACCEPTEE'
      && demande.affectationDemande?.ingenieurId === this.currentExpertId;
  }

  hasEngineerResponses(demande: DemandeAssistance): boolean {
    return !!demande.affectationDemande?.reponsesIngenieur?.length;
  }

  getAssignmentLabel(demande: DemandeAssistance): string {
    if (!demande.affectationDemande) {
      return 'Not assigned';
    }

    if (!demande.affectationDemande.ingenieurId && demande.affectationDemande.statut === 'ENVOYEE') {
      return 'Available';
    }

    return demande.affectationDemande.statut || 'Not assigned';
  }

  getSummary(description: string | undefined): string {
    if (!description) {
      return 'No description provided.';
    }
    return description.length > 150 ? description.slice(0, 150) + '...' : description;
  }

  private isForExpert(demande: DemandeAssistance): boolean {
    return !!this.currentExpertId
      && (
        demande.affectationDemande?.ingenieurId === this.currentExpertId
        || (
          !demande.affectationDemande?.ingenieurId
          && demande.affectationDemande?.statut === 'ENVOYEE'
          && (demande.canal === 'INGENIEUR' || demande.canal === 'MIXTE')
        )
      );
  }
}
