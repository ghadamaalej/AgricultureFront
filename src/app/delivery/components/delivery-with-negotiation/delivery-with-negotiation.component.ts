import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { DeliveryRequestService } from '../../services/delivery-request.service';

@Component({
  selector: 'app-delivery-with-negotiation',
  templateUrl: './delivery-with-negotiation.component.html',
  styleUrls: ['./delivery-with-negotiation.component.css']
})
export class DeliveryWithNegotiationComponent implements OnInit {
  @Input() delivery: any;
  @Output() negotiationCompleted = new EventEmitter<any>();
  @Output() negotiationError = new EventEmitter<string>();

  currentUserId: number = 0;
  userRole: 'agriculteur' | 'transporteur' = 'transporteur';
  showNegotiation: boolean = false;

  constructor(private deliveryService: DeliveryRequestService) {}

  ngOnInit(): void {
    this.currentUserId = this.deliveryService.getCurrentUserId();
    this.userRole = this.deliveryService.isUserFarmerRole() ? 'agriculteur' : 'transporteur';
    
    // Afficher la négociation si c'est une livraison en attente
    this.showNegotiation = this.delivery?.status === 'EN_ATTENTE' || 
                          this.delivery?.status === 'En attente' ||
                          (this.delivery?.prixNegocie && this.delivery?.prixNegocie > 0);
  }

  onNegotiationCompleted(result: any): void {
    this.negotiationCompleted.emit(result);
    // Mettre à jour la livraison locale
    if (result?.livraison) {
      this.delivery = { ...this.delivery, ...result.livraison };
    }
  }

  onNegotiationError(error: string): void {
    this.negotiationError.emit(error);
  }

  getUserRole(): string {
    return this.userRole;
  }

  canNegotiate(): boolean {
    return this.userRole === 'transporteur' && 
           (this.delivery?.status === 'EN_ATTENTE' || this.delivery?.status === 'En attente');
  }

  canRespondToNegotiation(): boolean {
    return this.userRole === 'agriculteur' && 
           this.delivery?.prixNegocie && 
           this.delivery?.prixNegocie > 0;
  }
}
