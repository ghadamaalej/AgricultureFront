import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DeliveryMapService } from '../../services/delivery-map.service';
import { DeliveryRequestService } from '../../services/delivery-request.service';
import { ActivatedRoute, Router } from '@angular/router';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

type DeliveryStatus = 'En attente' | 'Acceptée' | 'En cours' | 'Livrée' | 'Refusée';

type TrackingNotification = {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

type TrackingItem = {
  id: string;
  reference: string;
  product: string;
  status: DeliveryStatus;
  realStatus: DeliveryStatus;
  pickup: string;
  dropoff: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  currentLat?: number;
  currentLng?: number;
  progress: number;
  etaMinutes: number;
  ownerId?: number;
  farmerId?: number;
  transporterId?: number;
  farmerName?: string;
  transporterName?: string;
  rating?: number;
  ratingStatus?: 'PENDING' | 'RATED' | 'IGNORED';
  hasLivePosition?: boolean;
};

type TransporterProfile = {
  displayName: string;
  totalDeliveries: number;
  successRate: number;
  avgRating: number;
};

@Component({
  selector: 'app-delivery-tracking',
  standalone: false,
  templateUrl: './delivery-tracking.component.html',
  styleUrls: ['./delivery-tracking.component.css']
})
export class DeliveryTrackingComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer', { static: false }) mapContainer?: ElementRef;

  role = getDeliveryUserRole();
  private currentUserId = this.requestService.getCurrentUserId();
  showAllStatusOption = true;

  statuses: DeliveryStatus[] = ['En attente', 'En cours', 'Livrée', 'Refusée'];
  selectedStatus: DeliveryStatus | 'Tous' = 'Tous';
  searchText = '';

  deliveries: TrackingItem[] = [];

  selectedId = '';
  notificationDeliveryId = '';
  notification: TrackingNotification | null = null;
  showDeleteDialog = false;
  pendingDeleteDelivery: TrackingItem | null = null;
  deleteInProgress = false;
  selectedRating = 5;
  ratingInProgress = false;
  selectedTransporterProfile: TransporterProfile | null = null;
  simulationRunning = false;
  simulationProgress = 0;

  private simulationTimerId: number | null = null;

  constructor(
    private mapService: DeliveryMapService,
    private requestService: DeliveryRequestService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const isTransporter = this.role === 'transporteur' || this.role === 'transporter' || this.role.includes('transport');
    if (isTransporter) {
      this.router.navigate(['/delivery/active']);
      return;
    }

    this.loadDeliveries();
    this.route.queryParamMap.subscribe((params) => {
      this.notificationDeliveryId = params.get('deliveryId') || '';
      if (this.notificationDeliveryId) {
        this.selectedId = this.notificationDeliveryId;
        this.selectedStatus = 'Tous';
      }
      this.renderDeliveryRoute();
    });

    this.requestService.refreshFromBackend().subscribe(() => {
      this.loadDeliveries();
      this.selectedId = this.filteredDeliveries.find((delivery) => delivery.id === this.notificationDeliveryId)?.id
        || this.filteredDeliveries[0]?.id
        || '';
      this.renderDeliveryRoute();
    });
    this.showAllStatusOption = true;
    if (this.isFarmer()) {
      this.selectedStatus = 'Tous';
    }

    this.selectedId = this.filteredDeliveries.find((delivery) => delivery.id === this.notificationDeliveryId)?.id
      || this.filteredDeliveries[0]?.id
      || '';
  }

  ngAfterViewInit(): void {
    // Ensure map container is mounted before any marker rendering.
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.stopSimulation();
    this.mapService.destroy();
  }


  private initializeMap(): void {
    if (!this.mapContainer) return;

    const delivery = this.selectedDelivery;
    const hasPickup = Boolean(delivery?.pickupLat && delivery?.pickupLng);
    const centerLat = hasPickup
      ? ((delivery!.pickupLat as number) + ((delivery!.dropoffLat as number) || (delivery!.pickupLat as number))) / 2
      : 36.8065;
    const centerLng = hasPickup
      ? ((delivery!.pickupLng as number) + ((delivery!.dropoffLng as number) || (delivery!.pickupLng as number))) / 2
      : 10.1815;

    this.mapService.initMap(this.mapContainer.nativeElement, centerLat, centerLng, 10);
    this.renderDeliveryRoute();
  }

  private renderDeliveryRoute(): void {
    const delivery = this.selectedDelivery;
    if (!delivery) return;

    if (!this.mapService.getMap()) {
      this.initializeMap();
      if (!this.mapService.getMap()) {
        return;
      }
    }

    this.mapService.clear();

    if (delivery.pickupLat && delivery.pickupLng) {
      this.mapService.addMarker(
        delivery.pickupLat,
        delivery.pickupLng,
        `<strong>Departure:</strong> ${delivery.pickup}`,
        {
          title: 'Departure',
          zIndexOffset: 1000,
          icon: this.mapService.getPointIcon('start')
        }
      );
    }

    if (delivery.dropoffLat && delivery.dropoffLng) {
      this.mapService.addMarker(
        delivery.dropoffLat,
        delivery.dropoffLng,
        `<strong>Destination:</strong> ${delivery.dropoff}`,
        {
          title: 'Destination',
          zIndexOffset: 1000,
          icon: this.mapService.getPointIcon('end')
        }
      );
    }

    if (delivery.currentLat && delivery.currentLng && delivery.status === 'En cours') {
      this.mapService.addCircleMarker(delivery.currentLat, delivery.currentLng, 10, '#FF9800');
    }

    const routePoints = this.resolveRoutePoints(delivery);

    if (routePoints.length >= 2) {
      // Use OSRM for real road routing
      this.mapService.drawRouteOSRM(routePoints, '#4caf50', 5).then(() => {
        this.mapService.fitBounds(routePoints, 80);
      });
      this.mapService.getRouteGuidance(routePoints).then((guidance) => {
        if (!guidance) {
          return;
        }
        const selected = this.deliveries.find((item) => item.id === delivery.id);
        if (selected) {
          selected.etaMinutes = guidance.etaMinutes;
        }
      });
    }
  }

  get selectedDelivery(): TrackingItem | undefined {
    const source = this.filteredDeliveries;
    const selected = source.find((d) => d.id === this.selectedId);
    return selected || source[0];
  }

  get filteredDeliveries(): TrackingItem[] {
    const q = this.searchText.trim().toLowerCase();
    return this.deliveries.filter((d) => {
      const ownerOk = !this.isFarmer() || d.ownerId === this.currentUserId;
      const matchStatus = this.selectedStatus === 'Tous' || d.status === this.selectedStatus;
      const matchSearch = !q || (d.reference + ' ' + d.product + ' ' + d.pickup + ' ' + d.dropoff).toLowerCase().includes(q);
      return ownerOk && matchStatus && matchSearch;
    });
  }

  selectDelivery(id: string): void {
    this.selectedId = id;

    const delivery = this.selectedDelivery;
    if (!delivery || !delivery.pickupLat || !delivery.pickupLng) return;

    const map = this.mapService.getMap();
    if (!map) {
      this.initializeMap();
      return;
    }

    this.renderDeliveryRoute();
  }

  openDeliveryDetail(id: string, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/delivery/livraisons', id]);
  }

  editSelectedDelivery(): void {
    const delivery = this.selectedDelivery;
    if (!delivery) return;

    if (!this.canManageDelivery(delivery)) {
      this.pushNotification(
        'error',
        'Edit unavailable',
        'A request already accepted by a transporter can no longer be edited.'
      );
      return;
    }

    this.router.navigate(['/delivery/livraisons', delivery.id, 'edit']);
  }

  deleteSelectedDelivery(): void {
    const delivery = this.selectedDelivery;
    if (!delivery) return;

    if (!this.canManageDelivery(delivery)) {
      this.pushNotification(
        'error',
        'Deletion unavailable',
        'A request already accepted by a transporter can no longer be deleted.'
      );
      return;
    }

    this.pendingDeleteDelivery = delivery;
    this.showDeleteDialog = true;
  }

  canShowRatingPanel(delivery?: TrackingItem): boolean {
    if (!delivery || !this.isFarmer() || delivery.ownerId !== this.currentUserId) {
      return false;
    }
    if (delivery.status !== 'Livrée') {
      return false;
    }
    if ((delivery.rating || 0) > 0) {
      return false;
    }
    return delivery.ratingStatus !== 'IGNORED';
  }

  canShowRatedInfo(delivery?: TrackingItem): boolean {
    return Boolean(delivery && (delivery.rating || 0) > 0 && delivery.ownerId === this.currentUserId);
  }

  getFarmerDisplayName(delivery?: TrackingItem): string {
    if (delivery?.farmerName) {
      return delivery.farmerName;
    }
    return 'Farmer';
  }

  getTransporterDisplayName(delivery?: TrackingItem): string {
    if (delivery?.transporterName) {
      return delivery.transporterName;
    }
    return 'Transporter not assigned';
  }

  canOpenTransporterProfile(delivery?: TrackingItem): boolean {
    return Boolean(delivery?.transporterId && delivery.transporterId > 0);
  }

  openTransporterProfile(delivery?: TrackingItem): void {
    const transporterId = delivery?.transporterId || 0;
    if (!transporterId) {
      return;
    }

    const related = this.requestService.getAll().filter((item) => item.acceptedById === transporterId);
    const delivered = related.filter((item) => item.status === 'Livrée');
    const rated = delivered.filter((item) => Number(item.rating || 0) > 0);
    const successRate = related.length > 0 ? this.round2((delivered.length * 100) / related.length) : 0;
    const avgRating = rated.length > 0
      ? rated.reduce((sum, item) => sum + Number(item.rating || 0), 0) / rated.length
      : 0;

    this.selectedTransporterProfile = {
      displayName: this.getTransporterDisplayName(delivery),
      totalDeliveries: related.length,
      successRate,
      avgRating: this.round2(avgRating)
    };
  }

  closeTransporterProfile(): void {
    this.selectedTransporterProfile = null;
  }

  selectRating(value: number): void {
    if (value < 1 || value > 5 || this.ratingInProgress) {
      return;
    }
    this.selectedRating = value;
  }

  launchTrackingSimulation(): void {
    const delivery = this.selectedDelivery;
    if (!delivery || this.simulationRunning) {
      return;
    }

    this.stopSimulation();
    this.simulationRunning = true;
    this.simulationProgress = 0;

    const startLat = delivery.currentLat ?? delivery.pickupLat ?? 0;
    const startLng = delivery.currentLng ?? delivery.pickupLng ?? 0;
    const endLat = delivery.dropoffLat ?? startLat;
    const endLng = delivery.dropoffLng ?? startLng;

    this.simulationTimerId = window.setInterval(() => {
      if (!this.simulationRunning) {
        return;
      }

      this.simulationProgress = Math.min(100, this.simulationProgress + 20);
      const ratio = this.simulationProgress / 100;
      const lat = startLat + (endLat - startLat) * ratio;
      const lng = startLng + (endLng - startLng) * ratio;

      this.requestService.updateCurrentPosition(delivery.id, lat, lng).subscribe();

      if (this.simulationProgress >= 100) {
        this.stopSimulation();
      }
    }, 1000);
  }

  stopSimulation(): void {
    this.simulationRunning = false;
    if (this.simulationTimerId !== null) {
      window.clearInterval(this.simulationTimerId);
      this.simulationTimerId = null;
    }
  }

  submitRating(): void {
    const delivery = this.selectedDelivery;
    if (!delivery || !this.canShowRatingPanel(delivery) || this.ratingInProgress) {
      return;
    }

    this.ratingInProgress = true;
    this.requestService.evaluerTransporteur(delivery.id, this.selectedRating, this.currentUserId).subscribe((updated) => {
      this.ratingInProgress = false;
      if (!updated) {
        this.pushNotification('error', 'Rating not possible', 'The rating could not be saved.');
        return;
      }

      this.pushNotification('success', 'Thank you for your rating', `You rated this transporter ${this.selectedRating}/5.`);
      this.reloadDeliveries();
    });
  }

  ignoreRatingPrompt(): void {
    const delivery = this.selectedDelivery;
    if (!delivery || !this.canShowRatingPanel(delivery) || this.ratingInProgress) {
      return;
    }

    this.ratingInProgress = true;
    this.requestService.ignorerNotationTransporteur(delivery.id, this.currentUserId).subscribe((updated) => {
      this.ratingInProgress = false;
      if (!updated) {
        this.pushNotification('error', 'Action not possible', 'Unable to ignore this prompt at the moment.');
        return;
      }

      this.pushNotification('info', 'Rating skipped', 'You can continue without rating this transporter.');
      this.reloadDeliveries();
    });
  }

  closeDeleteDialog(): void {
    if (this.deleteInProgress) {
      return;
    }

    this.showDeleteDialog = false;
    this.pendingDeleteDelivery = null;
  }

  confirmDelete(): void {
    const delivery = this.pendingDeleteDelivery;
    if (!delivery || this.deleteInProgress) {
      return;
    }

    this.deleteInProgress = true;

    this.requestService.deleteApiDelivery(delivery.id).subscribe((deleted) => {
      this.deleteInProgress = false;
      this.showDeleteDialog = false;
      this.pendingDeleteDelivery = null;

      if (!deleted) {
        this.pushNotification(
          'error',
          'Deletion not possible',
          'The request may have already been accepted by a transporter. The list has been reloaded.'
        );
        this.reloadDeliveries();
        return;
      }

      this.pushNotification(
        'success',
        'Demande supprimée',
        `La demande ${delivery.reference} a été supprimée avec succès.`
      );
      this.reloadDeliveries();
    });
  }

  canManageSelectedDelivery(): boolean {
    return this.canManageDelivery(this.selectedDelivery);
  }

  trackIsActive(item: TrackingItem): boolean {
    return item.id === this.selectedId;
  }

  isFarmer(): boolean {
    return this.role === 'agriculteur' || this.role === 'farmer' || this.role.includes('agric');
  }

  private canManageDelivery(delivery?: TrackingItem): boolean {
    return Boolean(
      delivery &&
      this.isFarmer() &&
      delivery.ownerId === this.currentUserId &&
      delivery.realStatus === 'En attente'
    );
  }

  private loadDeliveries(): void {
    const requests = this.requestService.getAll();
    this.deliveries = requests.map((r) => {
      const inProgress = r.status === 'En cours';
      const delivered = r.status === 'Livrée';
      const accepted = r.status === 'Acceptée';
      const displayStatus: DeliveryStatus = accepted ? 'En attente' : (r.status as DeliveryStatus);
      const hasRealGps = Boolean(r.currentLat && r.currentLng);
      return {
        id: r.id,
        reference: r.reference,
        product: r.product,
        status: displayStatus,
        realStatus: r.status as DeliveryStatus,
        pickup: r.pickupLabel,
        dropoff: r.dropoffLabel,
        pickupLat: r.pickupLat,
        pickupLng: r.pickupLng,
        dropoffLat: r.dropoffLat,
        dropoffLng: r.dropoffLng,
        currentLat: r.currentLat || (delivered ? r.dropoffLat : undefined),
        currentLng: r.currentLng || (delivered ? r.dropoffLng : undefined),
        progress: delivered ? 100 : (inProgress && hasRealGps)
          ? this.computeProgress(r.pickupLat, r.pickupLng, r.dropoffLat, r.dropoffLng, r.currentLat!, r.currentLng!)
          : 0,
        etaMinutes: 0,
        ownerId: r.createdById,
        farmerId: r.createdById,
        transporterId: r.acceptedById,
        farmerName: this.formatPersonName(r.createdByEmail, 'Agriculteur', r.createdById),
        transporterName: this.formatPersonName(r.acceptedByEmail, 'Transporteur', r.acceptedById),
        rating: r.rating,
        ratingStatus: r.ratingStatus,
        hasLivePosition: hasRealGps
      };
    });
  }

  private resolveRoutePoints(delivery: TrackingItem): { lat: number; lng: number }[] {
    const points: { lat: number; lng: number }[] = [];

    if (delivery.status === 'En cours' && delivery.currentLat && delivery.currentLng) {
      points.push({ lat: delivery.currentLat, lng: delivery.currentLng });
      if (delivery.dropoffLat && delivery.dropoffLng) {
        points.push({ lat: delivery.dropoffLat, lng: delivery.dropoffLng });
      }
      return points;
    }

    if (delivery.pickupLat && delivery.pickupLng) {
      points.push({ lat: delivery.pickupLat, lng: delivery.pickupLng });
    }
    if (delivery.dropoffLat && delivery.dropoffLng) {
      points.push({ lat: delivery.dropoffLat, lng: delivery.dropoffLng });
    }
    return points;
  }

  private computeProgress(
    pickupLat: number, pickupLng: number,
    dropoffLat: number, dropoffLng: number,
    currentLat: number, currentLng: number
  ): number {
    const total = this.haversine(pickupLat, pickupLng, dropoffLat, dropoffLng);
    if (total === 0) return 0;
    const done = this.haversine(pickupLat, pickupLng, currentLat, currentLng);
    return Math.min(100, Math.round((done / total) * 100));
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private reloadDeliveries(): void {
    this.requestService.refreshFromBackend().subscribe(() => {
      this.loadDeliveries();
      this.selectedId = this.filteredDeliveries.find((delivery) => delivery.id === this.selectedId)?.id
        || this.filteredDeliveries[0]?.id
        || '';
      this.renderDeliveryRoute();
    });
  }

  private pushNotification(type: TrackingNotification['type'], title: string, message: string): void {
    this.notification = { type, title, message };
    window.setTimeout(() => (this.notification = null), 3500);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatPersonName(email?: string, fallbackRole: 'Agriculteur' | 'Transporteur' = 'Agriculteur', id?: number): string {
    if (email && email.includes('@')) {
      const localPart = email.split('@')[0];
      const normalized = localPart
        .replace(/[-_.]+/g, ' ')
        .replace(/\b(transporter|transporteur|farmer|agriculteur)\b/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
        .trim();
      if (normalized) {
        return normalized;
      }
    }
    return fallbackRole;
  }
}
