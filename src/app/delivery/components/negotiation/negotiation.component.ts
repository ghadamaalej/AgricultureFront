import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { DeliveryExtendedService, NegotiationRange, NegotiationResult } from '../../services/delivery-extended.service';

@Component({
  selector: 'app-negotiation',
  templateUrl: './negotiation.component.html',
  styleUrls: ['./negotiation.component.css']
})
export class NegotiationComponent implements OnInit {
  @Input() livraisonId: number = 0;
  @Input() currentUserId: number = 0;
  @Input() userRole: 'agriculteur' | 'transporteur' = 'transporteur';
  @Input() livraison: any;
  
  @Output() negotiationCompleted = new EventEmitter<NegotiationResult>();
  @Output() negotiationError = new EventEmitter<string>();

  negotiationRange: NegotiationRange | null = null;
  proposedPrice: number = 0;
  isNegotiating: boolean = false;
  showNegotiationBar: boolean = false;
  negotiationStatus: string = '';

  constructor(private deliveryService: DeliveryExtendedService) {}

  ngOnInit(): void {
    this.loadNegotiationRange();
    this.proposedPrice = this.livraison?.prix || 0;
  }

  loadNegotiationRange(): void {
    if (!this.livraisonId) return;

    this.deliveryService.getNegociationRange(this.livraisonId).subscribe({
      next: (range) => {
        this.negotiationRange = range;
        this.negotiationStatus = range.enNegociation ? 'EN_NEGOCIATION' : '';
      },
      error: (err) => {
        console.error('Erreur lors du chargement de la plage de négociation:', err);
        this.negotiationError.emit('Unable to load the negotiation range');
      }
    });
  }

  toggleNegotiationBar(): void {
    this.showNegotiationBar = !this.showNegotiationBar;
  }

  onPriceChange(event: any): void {
    this.proposedPrice = parseFloat(event.target.value);
  }

  calculatePricePercentage(): number {
    if (!this.negotiationRange) return 0;
    const base = this.negotiationRange.prixBase;
    return ((this.proposedPrice - base) / base) * 100;
  }

  getPriceBarColor(): string {
    const percentage = this.calculatePricePercentage();
    if (percentage < -5) return '#ef4444'; // rouge
    if (percentage > 5) return '#ef4444'; // rouge
    if (percentage < 0) return '#f59e0b'; // orange
    if (percentage > 0) return '#10b981'; // vert
    return '#6b7280'; // gris
  }

  isPriceValid(): boolean {
    if (!this.negotiationRange) return false;
    return this.proposedPrice >= this.negotiationRange.prixMin && 
           this.proposedPrice <= this.negotiationRange.prixMax;
  }

  submitNegotiation(): void {
    if (!this.isPriceValid()) {
      this.negotiationError.emit('The proposed price is not within the allowed range');
      return;
    }

    this.isNegotiating = true;
    
    if (this.userRole === 'transporteur') {
      this.deliveryService.negocierAvecBarre(this.livraisonId, this.currentUserId, this.proposedPrice).subscribe({
        next: (result) => {
          this.isNegotiating = false;
          this.negotiationCompleted.emit(result);
          this.showNegotiationBar = false;
          this.loadNegotiationRange();
        },
        error: (err) => {
          this.isNegotiating = false;
          this.negotiationError.emit('Error submitting the negotiation');
        }
      });
    }
  }

  acceptNegotiation(): void {
    if (this.userRole !== 'agriculteur') return;
    
    this.isNegotiating = true;
    this.deliveryService.accepterNegociationBarre(this.livraisonId, this.currentUserId).subscribe({
      next: (result) => {
        this.isNegotiating = false;
        this.negotiationCompleted.emit(result);
        this.loadNegotiationRange();
      },
      error: (err) => {
        this.isNegotiating = false;
        this.negotiationError.emit('Error accepting the negotiation');
      }
    });
  }

  refuseNegotiation(): void {
    if (this.userRole !== 'agriculteur') return;
    
    this.isNegotiating = true;
    this.deliveryService.refuserNegociationBarre(this.livraisonId, this.currentUserId).subscribe({
      next: (result) => {
        this.isNegotiating = false;
        this.negotiationCompleted.emit(result);
        this.loadNegotiationRange();
      },
      error: (err) => {
        this.isNegotiating = false;
        this.negotiationError.emit('Error rejecting the negotiation');
      }
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(price);
  }

  getNegotiationStatusText(): string {
    switch (this.negotiationStatus) {
      case 'EN_NEGOCIATION':
        return 'Negotiation in progress';
      case 'ACCEPTEE_NEGO':
        return 'Negotiation accepted';
      case 'REFUSEE_NEGO':
        return 'Negotiation rejected';
      default:
        return '';
    }
  }

  getNegotiationStatusColor(): string {
    switch (this.negotiationStatus) {
      case 'EN_NEGOCIATION':
        return '#f59e0b';
      case 'ACCEPTEE_NEGO':
        return '#10b981';
      case 'REFUSEE_NEGO':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }
}
