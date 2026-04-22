import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DeliveryMapService } from '../../services/delivery-map.service';
import { DeliveryRequestService, LivraisonApi, FarmerKnownTransporter } from '../../services/delivery-request.service';
import { getDeliveryUserRole, getDeliveryUserId, getDeliveryUserEmail } from '../../services/delivery-auth.helper';
import { DeliveryReceiptData } from '../delivery-receipt/delivery-receipt.component';

type DeliveryStatus = 'En attente' | 'Acceptée' | 'En cours' | 'Livrée' | 'Refusée';

@Component({
  selector: 'app-delivery-livraison-detail',
  standalone: false,
  templateUrl: './delivery-livraison-detail.component.html',
  styleUrls: ['./delivery-livraison-detail.component.css']
})
export class DeliveryLivraisonDetailComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer?: ElementRef;

  id = '';
  role = getDeliveryUserRole();
  notification: string | null = null;

  reference = '';
  product = 'Tomates';
  weightKg = 120;
  pickupAddress = 'Sousse (Zone A)';
  dropoffAddress = 'Monastir (Centre)';
  pickupLat = 35.8256;
  pickupLng = 10.6369;
  dropoffLat = 35.7483;
  dropoffLng = 10.8369;
  currentLat = 35.7870;
  currentLng = 10.7369;
  status: DeliveryStatus = 'En cours';
  priceTnd = 240;
  farmerId = 'far-123';
  transporterId = 'trk-456';
  transporterName = 'Not assigned';
  private knownTransportersByIdCache = new Map<number, string>();
  departureDate = '2026-03-25';
  expectedDeliveryDate = '2026-03-26';
  details = 'Fragile, expédier rapidement.';

  distanceKm = 14.2;
  durationHours = 3.2;
  eta = '55 min';

  newStatus: DeliveryStatus = this.status;
  assignTransporterId = this.transporterId;
  gpsLat = '36.78';
  gpsLng = '10.19';
  evaluation = 4;
  evaluationNote = '';
  private apiDelivery: LivraisonApi | null = null;

  // Signature & receipt
  signatureStatus = '';
  signatureSaved = false;
  receiptData: DeliveryReceiptData | null = null;
  private currentUserId = getDeliveryUserId() ?? 0;
  private apiFarmerId = 0;
  private farmerName = this.resolveFarmerName();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mapService: DeliveryMapService,
    private requestService: DeliveryRequestService
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    const navigationState = this.router.getCurrentNavigation()?.extras.state;
    if (navigationState?.['createdDelivery']) {
      this.setActionNotification('Delivery created successfully.');
    }
    this.requestService.getPreferredTransportersForCurrentFarmer().subscribe((items) => {
      items.forEach((t) => {
        if (t?.transporteurId && t.displayName) {
          this.knownTransportersByIdCache.set(t.transporteurId, t.displayName);
        }
      });
      this.refreshTransporterName();
    });

    this.requestService.refreshFromBackend().subscribe(() => {
      this.loadRequestData();
      // Load signature status from local cache immediately
      const cached = this.requestService.getById(this.id);
      if (cached?.signatureStatus) {
        this.signatureStatus = cached.signatureStatus;
      }
      if (cached?.createdById) {
        this.apiFarmerId = cached.createdById;
      }
      this.requestService.getApiById(this.id).subscribe((api) => {
        if (api) {
          this.apiDelivery = api;
          this.applyApiData(api);
          if (api.signatureStatus === 'SIGNED' && api.signatureData && !this.receiptData) {
            this.receiptData = this.buildReceipt(api.signatureData, api.signedAt);
          }
        }
      });
      this.renderRoute();
    });

    setTimeout(() => this.initializeMap(), 150);
  }

  private loadRequestData(): void {
    const request = this.requestService.getById(this.id);
    if (request) {
      this.reference = request.reference;
      this.product = request.product;
      this.weightKg = request.weightKg;
      this.pickupAddress = request.pickupLabel;
      this.dropoffAddress = request.dropoffLabel;
      this.pickupLat = request.pickupLat;
      this.pickupLng = request.pickupLng;
      this.dropoffLat = request.dropoffLat;
      this.dropoffLng = request.dropoffLng;
      this.status = request.status as DeliveryStatus;
      this.priceTnd = request.estimatedPrice;
      this.farmerId = String(request.createdById || request.createdByEmail);
      this.transporterId = request.acceptedById ? String(request.acceptedById) : 'Non assigne';
      this.transporterName = this.resolveTransporterName(request.acceptedById, request.acceptedByEmail);
      this.details = request.details || 'No details provided';

      const distance = this.haversineKm(this.pickupLat, this.pickupLng, this.dropoffLat, this.dropoffLng);
      this.distanceKm = Math.round(distance * 10) / 10;
      this.durationHours = Math.round((this.distanceKm / 55) * 1.25 * 10) / 10;
      this.eta = this.status === 'En cours' ? `${Math.max(10, Math.round(this.distanceKm * 2.5))} min` : '—';
      this.currentLat = (this.pickupLat + this.dropoffLat) / 2;
      this.currentLng = (this.pickupLng + this.dropoffLng) / 2;
    } else {
      this.reference = `DLV-${this.id || 'X'}${Date.now().toString(36).slice(-3).toUpperCase()}`;
    }

    this.newStatus = this.status;
    this.assignTransporterId = this.transporterId;
    this.gpsLat = String(this.currentLat);
    this.gpsLng = String(this.currentLng);
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  private initializeMap(): void {
    if (!this.mapContainer) return;

    const centerLat = (this.pickupLat + this.dropoffLat) / 2;
    const centerLng = (this.pickupLng + this.dropoffLng) / 2;

    this.mapService.initMap(this.mapContainer.nativeElement, centerLat, centerLng, 11);
    this.renderRoute();
  }

  private renderRoute(): void {
    if (!this.mapService.getMap()) return;
    this.mapService.clear();

    this.mapService.addMarker(
      this.pickupLat,
      this.pickupLng,
      `<strong>Departure:</strong> ${this.pickupAddress}`,
      {
        title: 'Departure',
        zIndexOffset: 1000,
        icon: this.mapService.getPointIcon('start')
      }
    );
    this.mapService.addMarker(
      this.dropoffLat,
      this.dropoffLng,
      `<strong>Destination:</strong> ${this.dropoffAddress}`,
      {
        title: 'Destination',
        zIndexOffset: 1000,
        icon: this.mapService.getPointIcon('end')
      }
    );

    if (this.status === 'En cours') {
      this.mapService.addCircleMarker(this.currentLat, this.currentLng, 10, '#FF9800');
    }

    const routePoints: { lat: number; lng: number }[] = [];
    routePoints.push({ lat: this.pickupLat, lng: this.pickupLng });
    routePoints.push({ lat: this.dropoffLat, lng: this.dropoffLng });

    // Use OSRM for real road routing
    this.mapService.drawRouteOSRM(routePoints, '#4caf50', 5).then(() => {
      this.mapService.fitBounds(routePoints, 80);
    });
  }

  isAdmin(): boolean {
    return this.role.includes('admin');
  }

  isTransporter(): boolean {
    return this.role.includes('transport');
  }

  isClient(): boolean {
    return this.role.includes('client') || this.role.includes('agric');
  }

  setActionNotification(message: string): void {
    this.notification = message;
    window.setTimeout(() => (this.notification = null), 3500);
  }

  changeStatus(): void {
    this.status = this.newStatus;
    this.requestService.updateStatus(this.id, this.status);
    this.setActionNotification(`Status updated: ${this.status}`);
    this.renderRoute();
  }

  assignTransporter(): void {
    const transporteurId = Number(this.assignTransporterId);
    if (!Number.isFinite(transporteurId) || transporteurId <= 0) {
      this.setActionNotification('Invalid transporter ID.');
      return;
    }

    this.requestService.assignTransporteur(this.id, transporteurId).subscribe((updated) => {
      if (!updated) {
        this.setActionNotification('Transporter assignment failed.');
        return;
      }
      this.apiDelivery = updated;
      this.applyApiData(updated);
      this.setActionNotification('Transporter assigned successfully.');
    });
  }

  updateGps(): void {
    const lat = parseFloat(this.gpsLat);
    const lng = parseFloat(this.gpsLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.setActionNotification('Invalid GPS coordinates.');
      return;
    }

    this.requestService.updateCurrentPosition(this.id, lat, lng).subscribe((updated) => {
      if (!updated) {
        this.setActionNotification('GPS update failed.');
        return;
      }
      this.apiDelivery = updated;
      this.currentLat = lat;
      this.currentLng = lng;
      this.renderRoute();
      this.setActionNotification(`GPS updated: ${lat}, ${lng}`);
    });
  }

  sendEvaluation(): void {
    this.requestService.evaluerTransporteur(this.id, this.evaluation, this.requestService.getCurrentUserId()).subscribe((updated) => {
      if (!updated) {
        this.setActionNotification('Failed to send the rating.');
        return;
      }
      this.apiDelivery = updated;
      this.setActionNotification(`Rating sent: ${this.evaluation}★`);
    });
  }

  goTracking(): void {
    if (this.isTransporter()) {
      this.router.navigate(['/delivery/active']);
      return;
    }
    this.router.navigate(['/delivery/livraisons']);
  }

  get shouldShowSignaturePad(): boolean {
    return (
      this.status === 'Livrée' &&
      this.isClient() &&
      this.signatureStatus !== 'SIGNED' &&
      !this.signatureSaved
    );
  }

  get isAlreadySigned(): boolean {
    return this.signatureStatus === 'SIGNED' || this.signatureSaved;
  }

  onSignatureConfirmed(signatureData: string): void {
    const numericId = Number(this.id);
    if (!numericId) return;

    this.requestService.saveSignature(numericId, signatureData, this.currentUserId).subscribe((updated) => {
      if (!updated) {
        this.setActionNotification('Signature could not be saved. Please try again.');
        return;
      }
      this.apiDelivery = updated;
      this.signatureStatus = 'SIGNED';
      this.signatureSaved = true;
      this.receiptData = this.buildReceipt(signatureData, updated.signedAt);
    });
  }

  private buildReceipt(signatureData: string, signedAt?: string): DeliveryReceiptData {
    return {
      reference: this.reference,
      product: this.product,
      weightKg: this.weightKg,
      pickupAddress: this.pickupAddress,
      dropoffAddress: this.dropoffAddress,
      distanceKm: this.distanceKm,
      departureDate: this.departureDate,
      expectedDeliveryDate: this.expectedDeliveryDate,
      priceTnd: this.priceTnd,
      farmerName: this.farmerName,
      transporterName: this.transporterName !== 'Not assigned' ? this.transporterName : `Transporter #${this.transporterId}`,
      signatureData,
      signedAt: signedAt || new Date().toISOString()
    };
  }

  private resolveFarmerName(): string {
    try {
      const raw = localStorage.getItem('authUser');
      if (raw) {
        const user = JSON.parse(raw);
        if (user?.username) return user.username;
        if (user?.email) return user.email.split('@')[0];
      }
    } catch { /* ignore */ }
    const email = getDeliveryUserEmail();
    return email !== 'unknown@local' ? email.split('@')[0] : 'Farmer';
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private applyApiData(api: LivraisonApi): void {
    this.reference = api.reference || this.reference;
    this.product = api.typeProduit || this.product;
    this.weightKg = Number(api.poids || this.weightKg);
    this.pickupAddress = api.adresseDepart || this.pickupAddress;
    this.dropoffAddress = api.adresseArrivee || this.dropoffAddress;
    this.pickupLat = Number(api.latDepart ?? this.pickupLat);
    this.pickupLng = Number(api.lngDepart ?? this.pickupLng);
    this.dropoffLat = Number(api.latArrivee ?? this.dropoffLat);
    this.dropoffLng = Number(api.lngArrivee ?? this.dropoffLng);
    this.currentLat = Number(api.latActuelle ?? (this.pickupLat + this.dropoffLat) / 2);
    this.currentLng = Number(api.lngActuelle ?? (this.pickupLng + this.dropoffLng) / 2);
    this.status = this.fromBackendStatus(api.status);
    this.priceTnd = Number(api.prix || this.priceTnd);
    this.farmerId = api.agriculteurId ? String(api.agriculteurId) : this.farmerId;
    this.transporterId = api.transporteurId ? String(api.transporteurId) : 'Non assigne';
    const apiAny = api as any;
    this.transporterName = this.resolveTransporterName(
      api.transporteurId || undefined,
      apiAny?.acceptedByEmail || apiAny?.transporteurEmail
    );
    this.departureDate = this.toShortDate(api.dateDepart || api.dateCreation);
    this.expectedDeliveryDate = this.toShortDate(api.dateLivraisonPrevue);
    this.details = api.detailsDemande || this.details;
    this.distanceKm = Math.round(this.haversineKm(this.pickupLat, this.pickupLng, this.dropoffLat, this.dropoffLng) * 10) / 10;
    this.durationHours = Math.round((this.distanceKm / 55) * 1.25 * 10) / 10;
    this.eta = this.status === 'En cours' ? `${Math.max(10, Math.round(this.distanceKm * 2.5))} min` : '—';
    this.newStatus = this.status;
    this.assignTransporterId = api.transporteurId ? String(api.transporteurId) : '';
    this.gpsLat = String(this.currentLat);
    this.gpsLng = String(this.currentLng);
    this.signatureStatus = api.signatureStatus || '';
    this.apiFarmerId = api.agriculteurId || 0;
  }

  private fromBackendStatus(status?: string): DeliveryStatus {
    switch ((status || '').toUpperCase()) {
      case 'ACCEPTEE':
        return 'Acceptée';
      case 'EN_COURS':
      case 'RETARD':
        return 'En cours';
      case 'LIVREE':
        return 'Livrée';
      case 'ANNULEE':
        return 'Refusée';
      case 'EN_ATTENTE':
      default:
        return 'En attente';
    }
  }

  private toShortDate(value?: string): string {
    if (!value) return '—';
    return value.slice(0, 10);
  }

  private resolveTransporterName(transporterId?: number, email?: string): string {
    if (!transporterId || transporterId <= 0) {
      return 'Not assigned';
    }
    const cached = this.knownTransportersByIdCache.get(transporterId);
    if (cached) {
      return cached;
    }
    const prettified = this.prettifyEmailName(email);
    if (prettified) {
      return prettified;
    }
    return `Transporter #${transporterId}`;
  }

  private prettifyEmailName(email?: string): string {
    if (!email || typeof email !== 'string') return '';
    const trimmed = email.trim();
    if (!trimmed) return '';
    const localPart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
    if (!localPart || /^(transporter|farmer|user)-?\d+$/i.test(localPart)) return '';
    const cleaned = localPart.replace(/\d+/g, '').replace(/[._\-+]+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private refreshTransporterName(): void {
    const idNumber = Number(this.transporterId);
    if (!Number.isFinite(idNumber) || idNumber <= 0) {
      return;
    }
    const cached = this.knownTransportersByIdCache.get(idNumber);
    if (cached) {
      this.transporterName = cached;
    }
  }
}
