import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LocationService } from '../../../services/location/location.service';
@Component({
  selector: 'app-my-rental-proposals',
  templateUrl: './my-rental-proposals.component.html',
  styleUrls: ['./my-rental-proposals.component.css']
})
export class MyRentalProposalsComponent implements OnInit {

  proposals: any[] = [];
  currentUserId: number | null = null;

  loading = false;
  errorMessage = '';

  showPopup = false;
  popupTitle = '';
  popupMessage = '';
  popupType: 'success' | 'error' = 'success';

  constructor(
    private authService: AuthService,
    private reservationService: ReservationVisiteService,
    private locationService: LocationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

    if (!this.currentUserId) {
      this.errorMessage = 'Please sign in first.';
      return;
    }

    this.loadProposals();
  }

  loadProposals(): void {
    if (!this.currentUserId) return;

    this.loading = true;
    this.errorMessage = '';

    this.reservationService.getProposalsByLocataire(this.currentUserId).subscribe({
        next: (data: any) => {
        const proposals = Array.isArray(data) ? data : [];

        if (proposals.length === 0) {
            this.proposals = [];
            this.loading = false;
            return;
        }

        const proposalRequests = proposals.map((proposal: any) =>
            this.locationService.getById(proposal.locationId).pipe(
            map((location: any) => ({
                ...proposal,
                location
            })),
            catchError((err) => {
                console.error('Failed to load location for proposal', proposal.id, err);
                return of({
                ...proposal,
                location: null
                });
            })
            )
        );

        forkJoin(proposalRequests).subscribe({
            next: (enrichedProposals: any[]) => {
            this.proposals = enrichedProposals;
            this.loading = false;
            },
            error: (err) => {
            console.error(err);
            this.errorMessage = 'Failed to load rental proposals.';
            this.loading = false;
            }
        });
        },
        error: (err) => {
        console.error(err);
        this.errorMessage = 'Failed to load rental proposals.';
        this.loading = false;
        }
    });
    }

  getTotalProposals(): number {
    return this.proposals.length;
  }

  getProposalCountByStatus(status: string): number {
    return this.proposals.filter(p => p.statut === status).length;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
        return 'Pending';
      case 'ACCEPTEE':
        return 'Accepted';
      case 'REFUSEE':
        return 'Refused';
      case 'PRETE_POUR_CONTRAT':
        return 'Contract Ready';
      case 'FINALISEE':
        return 'Finalized';
      default:
        return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
        return 'status-pending';
      case 'ACCEPTEE':
        return 'status-confirmed';
      case 'REFUSEE':
        return 'status-refused';
      case 'PRETE_POUR_CONTRAT':
        return 'status-done';
      default:
        return '';
    }
  }

  canGenerateContract(proposal: any): boolean {
  if (!proposal) return false;

  return (
    proposal.statut === 'PRETE_POUR_CONTRAT' ||
    proposal.statut === 'CONTRAT_SIGNE' ||
    proposal.statut === 'SIGNEE' ||
    !!proposal.signatureClient ||
    !!proposal.signatureAgriculteur ||
    !!proposal.clausesContrat
  );
}

getContractButtonLabel(proposal: any): string {
  if (
    proposal?.signatureClient ||
    proposal?.signatureAgriculteur ||
    proposal?.statut === 'CONTRAT_SIGNE' ||
    proposal?.statut === 'SIGNEE'
  ) {
    return 'View Contract';
  }

  return 'Generate Contract';
}

  generateContract(proposal: any): void {
  this.router.navigate(['/marketplace/rental-contract', proposal.id]);
}

  openPopup(title: string, message: string, type: 'success' | 'error') {
    this.popupTitle = title;
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;
  }

  closePopup() {
    this.showPopup = false;
  }

  goBack(): void {
    this.router.navigate(['/marketplace']);
  }

  getProposalTitle(proposal: any): string {
  const location = proposal?.location;

  if (!location) return 'Rental Proposal';

  if (location.type === 'terrain') {
    return location.nom?.trim() ? location.nom : 'Land Rental';
  }

  return location.nom?.trim() ? location.nom : 'Machine Rental';
}

getProposalTypeLabel(proposal: any): string {
  const location = proposal?.location;
  if (!location) return 'Rental';
  return location.type === 'terrain' ? 'Land' : 'Machine';
}

getProposalSubtitle(proposal: any): string {
  const location = proposal?.location;

  if (!location) return 'Rental proposal';

  if (location.type === 'terrain') {
    return location.localisation ? `Region: ${location.localisation}` : 'Land rental';
  }

  return location.marque ? `Brand: ${location.marque}` : 'Machine rental';
}

getProposalImage(proposal: any): string {
  const location = proposal?.location;
  const imageName = location?.image;

  return imageName
    ? `http://localhost:8090/uploads/${imageName}`
    : 'assets/images/product1.jpg';
}


goToRentalPayment(proposal: any): void {
  const proposalId = proposal?.id ?? proposal?.idProposition ?? proposal?.proposalId;

  if (!proposalId) {
    this.openPopup('Payment Error', 'Proposal id not found.', 'error');
    return;
  }

  this.router.navigate(['/marketplace/rental-payment', proposalId]);
}
}