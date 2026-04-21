import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DeliveryExtendedService, DeliveryNotification } from '../../services/delivery-extended.service';
import { DeliveryRequestService } from '../../services/delivery-request.service';
import { Subscription } from 'rxjs';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

type NotificationBanner = {
  type: 'success' | 'error';
  title: string;
  message: string;
};

type NegotiationCard = {
  id: string;
  numericId: number;
  reference: string;
  product: string;
  weightKg: number;
  pickup: string;
  dropoff: string;
  price: number;
  distanceKm: number;
  pricePerKm: number;
  quantityAmount: number;
  counterPrice: number;
  preferredDateTime?: string;
  proposedDateTime?: string;
  counterDateTime?: string;
  minCounterPrice: number;
  maxCounterPrice: number;
};

type ClientOfferCard = NegotiationCard & {
  from: string;
  notificationId: number;
};

@Component({
  selector: 'app-delivery-demandes',
  standalone: false,
  templateUrl: './delivery-demandes.component.html',
  styleUrls: ['./delivery-demandes.component.css']
})
export class DeliveryDemandesComponent implements OnInit, OnDestroy {
  notification: NotificationBanner | null = null;
  focusedRequestId = '';
  private readonly acceptingRequestIds = new Set<string>();

  transporterRequests: NegotiationCard[] = [];
  clientOffers: ClientOfferCard[] = [];

  private readonly currentUserId = this.requestService.getCurrentUserId();
  private readonly role = getDeliveryUserRole();
  readonly isFarmer = this.requestService.isUserFarmerRole();
  readonly isTransporter =
    this.role === 'transporteur' ||
    this.role === 'transporter' ||
    this.role.includes('transport') ||
    this.role.includes('livreur');
  private routeSubscription?: Subscription;
  private readonly ignoredKeyPrefix = 'deliveryIgnoredRequests:';
  private ignoredRequestIds = new Set<string>();

  constructor(
    private requestService: DeliveryRequestService,
    private extendedService: DeliveryExtendedService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadIgnoredRequests();

    this.routeSubscription = this.route.queryParamMap.subscribe((params) => {
      this.focusedRequestId = params.get('focus') || '';
    });

    this.requestService.refreshFromBackend().subscribe(() => {
      this.loadTransporterRequests();
      this.loadClientOffers();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  acceptRequest(card: NegotiationCard): void {
    if (this.acceptingRequestIds.has(card.id)) {
      return;
    }

    this.acceptingRequestIds.add(card.id);
    this.requestService.acceptByCurrentTransporter(card.id).subscribe((result) => {
      this.acceptingRequestIds.delete(card.id);
      if (!result.success) {
        this.pushNotification(
          'error',
          'Acceptance blocked',
          result.errorMessage || 'The transporter schedule does not allow this delivery.'
        );
        return;
      }

      this.transporterRequests = this.transporterRequests.filter((item) => item.id !== card.id);
      this.pushNotification('success', 'Request accepted', `${card.reference} has been taken over.`);
    });
  }

  isAccepting(requestId: string): boolean {
    return this.acceptingRequestIds.has(requestId);
  }

  refuseRequest(card: NegotiationCard): void {
    this.transporterRequests = this.transporterRequests.filter((item) => item.id !== card.id);
    this.pushNotification('success', 'Request removed', `${card.reference} has been removed from your list.`);
  }

  ignoreRequest(card: NegotiationCard): void {
    this.ignoredRequestIds.add(card.id);
    this.persistIgnoredRequests();
    this.transporterRequests = this.transporterRequests.filter((item) => item.id !== card.id);
    this.pushNotification('success', 'Request ignored', `${card.reference} is hidden for your account.`);
  }

  counterFromTransporter(card: NegotiationCard): void {
    if (!this.hasValidCounterRange(card)) {
      this.pushNotification('error', 'Range unavailable', 'The negotiation range is unavailable for this request.');
      return;
    }

    card.counterPrice = this.clampCounterPrice(card, card.counterPrice);

    if (card.counterPrice < card.minCounterPrice || card.counterPrice > card.maxCounterPrice) {
      this.pushNotification(
        'error',
        'Prix hors plage',
        `The counter-price must be between ${this.formatPrice(card.minCounterPrice)} and ${this.formatPrice(card.maxCounterPrice)}.`
      );
      return;
    }

    this.extendedService.negocierAvecBarre(
      card.numericId,
      this.currentUserId,
      card.counterPrice,
      card.counterDateTime || card.preferredDateTime || null
    ).subscribe({
      next: (result) => {
        if (!result) {
          this.pushNotification('error', 'Failed', 'Unable to send the counter-proposal.');
          return;
        }
        this.transporterRequests = this.transporterRequests.filter((item) => item.id !== card.id);
        this.loadClientOffers();
        this.pushNotification(
          'success',
          'Counter-price sent',
          `${card.reference} — proposal sent to the farmer for validation.`
        );
      },
      error: () => {
        this.pushNotification('error', 'Error', 'The negotiation failed.');
      }
    });
  }

  acceptOffer(card: ClientOfferCard): void {
    this.handleClientOffer(card, 'ACCEPT', 'Offer accepted', `${card.reference} has been accepted.`);
  }

  refuseOffer(card: ClientOfferCard): void {
    this.handleClientOffer(card, 'REJECT', 'Offer rejected', `${card.reference} has been rejected.`);
  }

  proposeCounterFromClient(card: ClientOfferCard): void {
    if (!this.hasValidCounterRange(card)) {
      this.pushNotification('error', 'Range unavailable', 'The negotiation range is unavailable for this proposal.');
      return;
    }

    card.counterPrice = this.clampCounterPrice(card, card.counterPrice);

    this.extendedService.handleNotificationAction(
      card.notificationId,
      this.currentUserId,
      'COUNTER_PROPOSE',
      card.counterPrice,
      card.counterDateTime || card.proposedDateTime || card.preferredDateTime || null
    ).subscribe({
      next: (updated) => {
        if (!updated) {
          this.pushNotification('error', 'Failed', 'Unable to send the counter-proposal.');
          return;
        }
        this.loadClientOffers();
        this.pushNotification('success', 'Counter-proposal sent', `${card.reference} — new price proposed.`);
      },
      error: () => {
        this.pushNotification('error', 'Error', 'The counter-proposal failed.');
      }
    });
  }

  private handleClientOffer(card: ClientOfferCard, action: string, title: string, message: string): void {
    this.extendedService.handleNotificationAction(card.notificationId, this.currentUserId, action).subscribe({
      next: (updated) => {
        if (!updated) {
          this.pushNotification('error', 'Failed', 'The action could not be applied.');
          return;
        }
        this.requestService.refreshFromBackend().subscribe(() => {
          this.loadTransporterRequests();
          this.loadClientOffers();
          this.pushNotification('success', title, message);
        });
      },
      error: () => {
        this.pushNotification('error', 'Error', 'The action failed.');
      }
    });
  }

  private loadTransporterRequests(): void {
    if (this.isFarmer) {
      this.transporterRequests = [];
      return;
    }

    this.extendedService.getDemandesEnCoursPourTransporteur(this.currentUserId).subscribe({
      next: (items) => {
        this.transporterRequests = items.map((item) => {
          const livraison = item?.livraison ?? {};
          const suggestedPrice = Number(item?.prixSuggere ?? livraison.prix ?? 0);
          const rawMin = Number(item?.negociationRange?.min ?? this.round2(suggestedPrice * 0.95));
          const rawMax = Number(item?.negociationRange?.max ?? this.round2(suggestedPrice * 1.05));
          const rangeMin = Math.min(rawMin, rawMax);
          const rangeMax = Math.max(rawMin, rawMax);
          const initialCounter = this.clampByRange(suggestedPrice, rangeMin, rangeMax);
          return {
            id: String(livraison.id ?? ''),
            numericId: Number(livraison.id ?? 0),
            reference: livraison.reference ?? `DLV-${livraison.id ?? 'X'}`,
            product: livraison.typeProduit ?? 'Produit',
            weightKg: Number(livraison.poids ?? 0),
            pickup: livraison.adresseDepart ?? 'Départ inconnu',
            dropoff: livraison.adresseArrivee ?? 'Destination inconnue',
            price: suggestedPrice,
            distanceKm: Number(item?.pricingBreakdown?.distanceKm ?? item?.distanceKm ?? livraison.distanceKm ?? 0),
            pricePerKm: Number(item?.pricingBreakdown?.pricePerKm ?? item?.pricePerKm ?? 0),
            quantityAmount: Number(item?.pricingBreakdown?.quantityAmount ?? 0),
            counterPrice: initialCounter,
            preferredDateTime: item?.preferredDateTime ?? livraison.datePreferenceAgriculteur ?? livraison.dateDepart ?? undefined,
            proposedDateTime: item?.proposedDateTime ?? livraison.dateProposeeNegociation ?? undefined,
            counterDateTime: item?.proposedDateTime ?? item?.preferredDateTime ?? livraison.dateDepart ?? undefined,
            minCounterPrice: rangeMin,
            maxCounterPrice: rangeMax
          };
        }).filter((card) => !this.ignoredRequestIds.has(card.id));
      },
      error: () => {
        this.transporterRequests = [];
      }
    });
  }

  private loadClientOffers(): void {
    if (!this.isFarmer) {
      this.clientOffers = [];
      return;
    }

    this.extendedService.getPendingNegotiationNotifications(this.currentUserId).subscribe({
      next: (notifications) => {
        this.clientOffers = notifications.map((notification) => this.toClientOfferCard(notification));
      },
      error: () => {
        this.clientOffers = [];
      }
    });
  }

  private toClientOfferCard(notification: DeliveryNotification): ClientOfferCard {
    const request = this.requestService.getById(String(notification.livraisonId));
    const proposedPrice = Number(notification.proposedPrice || 0);
    const rawMin = Number(notification.minAllowedPrice ?? this.round2(proposedPrice * 0.95));
    const rawMax = Number(notification.maxAllowedPrice ?? this.round2(proposedPrice * 1.05));
    const rangeMin = Math.min(rawMin, rawMax);
    const rangeMax = Math.max(rawMin, rawMax);
    const initialCounter = this.clampByRange(proposedPrice || rangeMin, rangeMin, rangeMax);

    return {
      id: String(notification.livraisonId),
      numericId: notification.livraisonId,
      notificationId: notification.id,
      reference: request?.reference || `DLV-${notification.livraisonId}`,
      product: request?.product || 'Produit',
      weightKg: request?.weightKg || 0,
      pickup: request?.pickupLabel || 'Départ inconnu',
      dropoff: request?.dropoffLabel || 'Destination inconnue',
      price: proposedPrice,
      distanceKm: 0,
      pricePerKm: 0,
      quantityAmount: 0,
      counterPrice: initialCounter,
      preferredDateTime: notification.preferredDateTime || request?.departureDate || request?.plannedDeliveryDate || undefined,
      proposedDateTime: notification.proposedDateTime || undefined,
      counterDateTime: notification.proposedDateTime || notification.preferredDateTime || request?.departureDate || undefined,
      minCounterPrice: rangeMin,
      maxCounterPrice: rangeMax,
      from: `Transporteur #${notification.fromUserId || 0}`
    };
  }

  onCounterPriceInput(card: NegotiationCard): void {
    card.counterPrice = this.clampCounterPrice(card, card.counterPrice);
  }

  hasValidCounterRange(card: NegotiationCard): boolean {
    return Number.isFinite(card.minCounterPrice)
      && Number.isFinite(card.maxCounterPrice)
      && card.maxCounterPrice > card.minCounterPrice;
  }

  private clampCounterPrice(card: NegotiationCard, candidate: number): number {
    if (!this.hasValidCounterRange(card)) {
      return Number(candidate) || 0;
    }

    return this.clampByRange(Number(candidate) || card.minCounterPrice, card.minCounterPrice, card.maxCounterPrice);
  }

  private clampByRange(value: number, min: number, max: number): number {
    const safe = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, safe));
  }

  isFocusedRequest(card: NegotiationCard): boolean {
    return this.focusedRequestId !== '' && card.id === this.focusedRequestId;
  }

  get visibleTransporterRequests(): NegotiationCard[] {
    if (!this.focusedRequestId) {
      return this.transporterRequests;
    }
    return this.transporterRequests.filter((card) => card.id === this.focusedRequestId);
  }

  get isFocusedMode(): boolean {
    return this.isTransporter && this.focusedRequestId !== '';
  }

  private pushNotification(type: NotificationBanner['type'], title: string, message: string): void {
    this.notification = { type, title, message };
    window.setTimeout(() => (this.notification = null), 4000);
  }

  private formatPrice(value: number): string {
    return `${value.toFixed(2)} TND`;
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return 'Not specified';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private loadIgnoredRequests(): void {
    if (!this.isTransporter || this.currentUserId <= 0) {
      this.ignoredRequestIds.clear();
      return;
    }
    try {
      const raw = localStorage.getItem(this.ignoredStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
      this.ignoredRequestIds = new Set(ids);
    } catch {
      this.ignoredRequestIds = new Set<string>();
    }
  }

  private persistIgnoredRequests(): void {
    if (!this.isTransporter || this.currentUserId <= 0) {
      return;
    }
    localStorage.setItem(this.ignoredStorageKey(), JSON.stringify(Array.from(this.ignoredRequestIds)));
  }

  private ignoredStorageKey(): string {
    return `${this.ignoredKeyPrefix}${this.currentUserId}`;
  }
}
