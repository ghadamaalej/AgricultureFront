import { ViewChild, ElementRef, AfterViewInit, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../services/auth/auth.service';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
import { UserContractService } from '../../../services/user/user-contract.service';
import { LocationService } from '../../../services/location/location.service';
import SignaturePad from 'signature_pad';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Router } from '@angular/router';
import { RentalPaymentService } from '../../../services/rental-payment/rental-payment.service';

@Component({
  selector: 'app-rental-contract',
  templateUrl: './rental-contract.component.html',
  styleUrls: ['./rental-contract.component.css']
})
export class RentalContractComponent implements OnInit, AfterViewInit {

  @ViewChild('clientSignatureCanvas') clientSignatureCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('contractContent') contractContent?: ElementRef<HTMLElement>;

  exportingPdf = false;
  clientSignaturePad!: SignaturePad;
  clientSignatureReady = false;
  savingClientSignature = false;
  proposal: any = null;
  locataire: any = null;
  agriculteur: any = null;
  cachetImage = 'assets/images/cachet.png';

  currentUserId: number | null = null;

  currentUserRole: string | null = null;
  loading = false;
  errorMessage = '';

  fromAdmin = false;
  isAdmin = false;

  locationData: any = null;

  rentalPayments: any[] = [];
autoPaymentLoading = false;
autoPaymentActivated = false;


  ngAfterViewInit(): void {}

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private reservationService: ReservationVisiteService,
    private authService: AuthService,
    private UserContractService: UserContractService,
    private locationService: LocationService,
    private location: Location,
    private rentalPaymentService: RentalPaymentService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.currentUserRole = this.authService.getCurrentRole();

    this.isAdmin = this.currentUserRole === 'ADMIN';
    this.fromAdmin =
      this.isAdmin ||
      this.route.snapshot.queryParamMap.get('from') === 'admin';

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.errorMessage = 'Contract not found.';
      return;
    }

    if (!this.currentUserId) {
      this.errorMessage = 'Please sign in first.';
      return;
    }

    this.loadContract(+id);
  }

  loadContract(proposalId: number): void {
  this.loading = true;
  this.errorMessage = '';

  this.reservationService.getProposalById(proposalId).subscribe({
    next: (proposalData: any) => {
      const isAdmin = this.currentUserRole === 'ADMIN';

      const isAllowed =
        isAdmin ||
        this.currentUserId === proposalData?.locataireId ||
        this.currentUserId === proposalData?.agriculteurId;

      if (!isAllowed) {
        this.proposal = null;
        this.errorMessage = 'You are not allowed to access this contract.';
        this.loading = false;
        return;
      }

      this.proposal = proposalData;
      this.loadRentalPayments();

      forkJoin({
        locataire: this.UserContractService.getUserById(this.proposal.locataireId),
        agriculteur: this.UserContractService.getUserById(this.proposal.agriculteurId),
        locationData: this.locationService.getById(this.proposal.locationId)
      }).subscribe({
        next: (data: any) => {
          this.locataire = data.locataire;
          this.agriculteur = data.agriculteur;
          this.locationData = data.locationData;
          this.loading = false;

          setTimeout(() => {
            if (this.canClientSign()) {
              this.initClientSignaturePad();
            }
          }, 100);
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = 'Unable to load contract information.';
          this.loading = false;
        }
      });
    },
    error: (err) => {
      console.error(err);
      this.errorMessage = 'Unable to load contract.';
      this.loading = false;
    }
  });
}

  goBack(): void {
  if (this.fromAdmin) {
    this.router.navigate(['/dashboard/marketplace'], {
      queryParams: { tab: 'contracts' }
    });
    return;
  }

  this.location.back();
}

  printContract(): void {
    window.print();
  }

  getFullName(user: any): string {
    if (!user) return '-';
    return `${user.prenom || ''} ${user.nom || ''}`.trim() || '-';
  }

  isLandRental(): boolean {
  return this.locationData?.type === 'terrain';
}

isMachineRental(): boolean {
  return this.locationData?.type === 'materiel' || this.locationData?.type === 'machine';
}

isCurrentUserLocataire(): boolean {
  return this.currentUserId === this.proposal?.locataireId;
}

canClientSign(): boolean {
  return this.isCurrentUserLocataire()
    && this.proposal?.statut === 'PRETE_POUR_CONTRAT'
    && !this.proposal?.signatureClient;
}

initClientSignaturePad(): void {
  if (!this.clientSignatureCanvas) return;

  const canvas = this.clientSignatureCanvas.nativeElement;
  const ratio = Math.max(window.devicePixelRatio || 1, 1);

  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext('2d')?.scale(ratio, ratio);

  this.clientSignaturePad = new SignaturePad(canvas, {
    minWidth: 1,
    maxWidth: 2.5,
    penColor: '#111827'
  });

  this.clientSignatureReady = true;
}

clearClientSignature(): void {
  if (this.clientSignaturePad) {
    this.clientSignaturePad.clear();
  }
}

isClientSignatureEmpty(): boolean {
  return !this.clientSignaturePad || this.clientSignaturePad.isEmpty();
}


signContract(): void {
  if (!this.currentUserId || !this.proposal?.id) {
    this.errorMessage = 'Contract not found.';
    return;
  }

  if (this.isClientSignatureEmpty()) {
    this.errorMessage = 'Client signature is required.';
    return;
  }

  this.savingClientSignature = true;
  this.errorMessage = '';

  const payload = {
    signatureClient: this.clientSignaturePad.toDataURL('image/png')
  };

  this.reservationService.signContractByClient(
    this.proposal.id,
    this.currentUserId,
    payload
  ).subscribe({
    next: (updatedProposal: any) => {
      this.proposal = updatedProposal;
      this.savingClientSignature = false;
    },
    error: (err) => {
      console.error(err);
      this.errorMessage = err?.error?.message || 'Failed to sign contract.';
      this.savingClientSignature = false;
    }
  });
}

async exportContract(): Promise<void> {
  if (!this.contractContent) {
    this.errorMessage = 'Contract not found.';
    return;
  }

  const element = this.contractContent.nativeElement;

  try {
    this.exportingPdf = true;
    this.errorMessage = '';

    // force desktop layout during export
    element.classList.add('pdf-export-mode');

    await new Promise(resolve => setTimeout(resolve, 150));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 8;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    let imgWidth = maxWidth;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = (canvas.width * imgHeight) / canvas.height;
    }

    const x = (pageWidth - imgWidth) / 2;
    const y = margin;

    pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight, '', 'FAST');

    const contractId = this.proposal?.id ? `_${this.proposal.id}` : '';
    pdf.save(`contrat_location${contractId}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    this.errorMessage = 'Failed to export contract.';
  } finally {
    element.classList.remove('pdf-export-mode');
    this.exportingPdf = false;
  }
}

loadRentalPayments(): void {
  const proposalId = this.getProposalId();

  if (!proposalId) return;

  this.rentalPaymentService.getPaymentsByProposition(proposalId).subscribe({
    next: (payments) => {
      this.rentalPayments = payments || [];

      this.autoPaymentActivated = this.rentalPayments.some(p =>
        p.stripeCustomerId && p.stripePaymentMethodId
      );
    },
    error: (err) => {
      console.error('Could not load rental payments', err);
    }
  });
}
getProposalId(): number | null {
  return Number(
    this.proposal?.id ??
    this.proposal?.idProposition ??
    this.proposal?.proposalId ??
    null
  );
}

activateAutoPayment(): void {
  const proposalId = this.getProposalId();

  console.log('FULL PROPOSAL OBJECT:', this.proposal);
  console.log('PROPOSAL ID USED FOR PAYMENT:', proposalId);

  if (!proposalId) {
    alert('Proposal not found.');
    return;
  }

  this.autoPaymentLoading = true;

  this.rentalPaymentService.setupCard(proposalId).subscribe({
    next: (res) => {
      this.autoPaymentLoading = false;

      if (res?.url) {
        window.location.href = res.url;
      } else {
        alert('Stripe setup URL not received.');
      }
    },
    error: (err) => {
      this.autoPaymentLoading = false;
      console.error('Auto payment setup failed', err);
      alert('Could not activate auto payment.');
    }
  });
}

chargeDueNow(): void {
  this.rentalPaymentService.chargeDueNow().subscribe({
    next: () => {
      alert('Due rental payments charged.');
      this.loadRentalPayments();
    },
    error: (err) => {
      console.error('Charge due failed', err);
      alert('Could not charge due payments.');
    }
  });
}

getNextPaymentDate(): string {
  if (!this.rentalPayments || this.rentalPayments.length === 0) {
    return '-';
  }

  const next = this.rentalPayments.find(p => p.statut === 'UNPAID' || p.statut === 'FAILED');

  return next?.dateEcheance || 'Completed';
}

getPaidCount(): number {
  return this.rentalPayments?.filter(p => p.statut === 'PAID').length || 0;
}
}