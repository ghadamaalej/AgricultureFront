import { ViewChild, ElementRef, AfterViewInit, Component, OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth/auth.service';
import { Router } from '@angular/router';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
import { LocationService } from '../../../services/location/location.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UserContractService } from '../../../services/user/user-contract.service';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-manage-rental-proposals',
  templateUrl: './manage-rental-proposals.component.html',
  styleUrls: ['./manage-rental-proposals.component.css']
})
export class ManageRentalProposalsComponent implements OnInit, AfterViewInit {

  @ViewChild('signatureCanvas') signatureCanvas?: ElementRef<HTMLCanvasElement>;

  signaturePad!: SignaturePad;
  signatureReady = false;
  proposals: any[] = [];
  currentUserId: number | null = null;

  showPopup = false;
  popupTitle = '';
  popupMessage = '';
  popupType: 'success' | 'error' = 'success';

  refuseModalOpen = false;
  selectedProposal: any = null;
  refusalMessage = '';

  contractModalOpen = false;
  selectedContractProposal: any = null;

  contractForm = {
    signatureAgriculteur: '',
    clausesContrat: ''
  };

  notificationsOpen = false;

  tenantModalOpen = false;
  selectedTenant: any = null;
  tenantLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private reservationService: ReservationVisiteService,
    private locationService: LocationService,
    private userContractService: UserContractService
  ) {}

  ngAfterViewInit(): void {
    // nothing here for now
    }

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

    if (!this.currentUserId) {
      this.openPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    this.loadProposals();
  }

  loadProposals(): void {
    if (!this.currentUserId) return;

    this.reservationService.getProposalsByAgriculteur(this.currentUserId).subscribe({
      next: (data: any) => {
        const proposals = Array.isArray(data) ? data : [];

        if (proposals.length === 0) {
          this.proposals = [];
          return;
        }

        const requests = proposals.map((proposal: any) =>
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

        forkJoin(requests).subscribe({
          next: (enriched: any[]) => {
            this.proposals = enriched;
          },
          error: (err) => {
            console.error(err);
            this.openPopup('Error', 'Failed to load rental proposals.', 'error');
          }
        });
      },
      error: (err) => {
        console.error(err);
        this.openPopup('Error', 'Failed to load rental proposals.', 'error');
      }
    });
  }

  getTotalProposals(): number {
    return this.proposals.length;
  }

  getProposalCountByStatus(status: string): number {
    return this.proposals.filter(p => p.statut === status).length;
  }

  getPendingNotifications(): any[] {
    return this.proposals.filter(p => p.statut === 'EN_ATTENTE');
  }

  getPendingCount(): number {
    return this.getPendingNotifications().length;
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
  }

  getStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    EN_ATTENTE: 'Pending',
    ACCEPTEE: 'Accepted',
    REFUSEE: 'Refused',
    PRETE_POUR_CONTRAT: 'Contract Ready',
    FINALISEE: 'Finalized'
  };

  return labels[status] || status;
}

  getStatusClass(status: string): string {
  const classes: { [key: string]: string } = {
    EN_ATTENTE: 'status-pending',
    ACCEPTEE: 'status-confirmed',
    REFUSEE: 'status-refused',
    PRETE_POUR_CONTRAT: 'status-confirmed',
    FINALISEE: 'status-done'
  };

  return classes[status] || '';
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
      return location.localisation
        ? `Region: ${location.localisation}`
        : 'Land rental request';
    }

    return location.marque
      ? `Brand: ${location.marque}`
      : 'Machine rental request';
  }

  getProposalImage(proposal: any): string {
    const location = proposal?.location;
    const imageName = location?.image || location?.photo || location?.locationImage;

    return imageName
      ? `http://localhost:8090/uploads/${imageName}`
      : 'assets/images/product1.jpg';
  }

  canManage(proposal: any): boolean {
    return proposal?.statut === 'EN_ATTENTE';
  }

  canCompleteContractInfo(proposal: any): boolean {
    return proposal?.statut === 'ACCEPTEE';
  }

  acceptProposal(proposal: any): void {
    if (!this.currentUserId) return;

    this.reservationService.acceptProposal(proposal.id, this.currentUserId).subscribe({
      next: () => {
        this.openPopup('Success', 'Proposal accepted successfully.', 'success');
        this.loadProposals();
      },
      error: (err) => {
        this.openPopup('Error', err?.error?.message || 'Failed to accept proposal.', 'error');
      }
    });
  }

  openRefuseModal(proposal: any): void {
    this.selectedProposal = proposal;
    this.refusalMessage = '';
    this.refuseModalOpen = true;
  }

  closeRefuseModal(): void {
    this.refuseModalOpen = false;
    this.selectedProposal = null;
    this.refusalMessage = '';
  }

  confirmRefuseProposal(): void {
    if (!this.currentUserId || !this.selectedProposal?.id) return;

    this.reservationService.refuseProposal(
      this.selectedProposal.id,
      this.currentUserId,
      this.refusalMessage
    ).subscribe({
      next: () => {
        this.closeRefuseModal();
        this.openPopup('Success', 'Proposal refused successfully.', 'success');
        this.loadProposals();
      },
      error: (err) => {
        this.openPopup('Error', err?.error?.message || 'Failed to refuse proposal.', 'error');
      }
    });
  }

  openContractModal(proposal: any): void {
  this.selectedContractProposal = proposal;

  this.contractForm = {
    signatureAgriculteur: proposal.signatureAgriculteur || '',
    clausesContrat: proposal.clausesContrat || ''
  };

  this.contractModalOpen = true;

  setTimeout(() => {
    this.initSignaturePad();

    if (this.contractForm.signatureAgriculteur && this.signaturePad) {
      this.signaturePad.fromDataURL(this.contractForm.signatureAgriculteur);
    }
  }, 100);
}

  closeContractModal(): void {
  this.contractModalOpen = false;
  this.selectedContractProposal = null;
  this.signatureReady = false;

  this.contractForm = {
    signatureAgriculteur: '',
    clausesContrat: ''
  };
}

  saveContractInfo(): void {
  if (!this.currentUserId) {
    this.openPopup('Login Required', 'Please sign in first.', 'error');
    return;
  }

  if (!this.selectedContractProposal?.id) {
    this.openPopup('Error', 'Proposal not found.', 'error');
    return;
  }

  if (this.isSignatureEmpty()) {
    this.openPopup('Missing Field', 'Farmer signature is required.', 'error');
    return;
  }

  const signatureBase64 = this.signaturePad.toDataURL('image/png');

  const payload = {
    signatureAgriculteur: signatureBase64,
    clausesContrat: this.contractForm.clausesContrat
  };

  this.reservationService.saveContractInfo(
    this.selectedContractProposal.id,
    this.currentUserId,
    payload
  ).subscribe({
    next: () => {
      this.closeContractModal();
      this.openPopup('Success', 'Contract information saved successfully.', 'success');
      this.loadProposals();
    },
    error: (err) => {
      this.openPopup(
        'Error',
        err?.error?.message || 'Failed to save contract information.',
        'error'
      );
    }
  });
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

  viewTenantProfile(proposal: any): void {
  const tenantId = proposal?.locataireId;

  if (!tenantId) {
    this.openPopup('Error', 'Tenant information not found.', 'error');
    return;
  }

  this.tenantLoading = true;
  this.tenantModalOpen = true;
  this.selectedTenant = null;

  this.userContractService.getUserById(tenantId).subscribe({
    next: (data: any) => {
      this.selectedTenant = data;
      this.tenantLoading = false;
    },
    error: (err) => {
      console.error(err);
      this.tenantLoading = false;
      this.tenantModalOpen = false;
      this.openPopup('Error', 'Failed to load tenant information.', 'error');
    }
  });
}

closeTenantModal(): void {
  this.tenantModalOpen = false;
  this.selectedTenant = null;
  this.tenantLoading = false;
}

getTenantPhoto(user: any): string {
  const photo = user?.photo;

  return photo
    ? `http://localhost:8090/uploads/${photo}`
    : 'assets/images/default-user.png';
}

initSignaturePad(): void {
  if (!this.signatureCanvas) return;

  const canvas = this.signatureCanvas.nativeElement;

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext('2d')?.scale(ratio, ratio);

  this.signaturePad = new SignaturePad(canvas, {
    minWidth: 1,
    maxWidth: 2.5,
    penColor: '#111827'
  });

  this.signatureReady = true;
}

clearSignature(): void {
  if (this.signaturePad) {
    this.signaturePad.clear();
  }
}

isSignatureEmpty(): boolean {
  return !this.signaturePad || this.signaturePad.isEmpty();
}


viewContract(proposal: any): void {
  const proposalId = proposal?.id ?? proposal?.idProposition ?? proposal?.proposalId;

  if (!proposalId) {
    this.openPopup('Contract Error', 'Proposal id not found.', 'error');
    return;
  }

  this.router.navigate(['/marketplace/rental-contract', proposalId]);
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