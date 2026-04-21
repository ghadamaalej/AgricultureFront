import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DeliveryMapService } from '../../services/delivery-map.service';
import { DeliveryExtendedService, DeliveryGroup, GroupDetails, GroupRoutePoint } from '../../services/delivery-extended.service';
import { DeliveryRequestService } from '../../services/delivery-request.service';

type GroupableDelivery = {
  id: number;
  reference: string;
  poids: number;
  prix: number;
  grouped?: boolean;
  latDepart: number;
  lngDepart: number;
  latArrivee: number;
  lngArrivee: number;
  adresseDepart?: string;
  adresseArrivee?: string;
};

@Component({
  selector: 'app-delivery-groups',
  standalone: false,
  templateUrl: './delivery-groups.component.html',
  styleUrls: ['./delivery-groups.component.css']
})
export class DeliveryGroupsComponent implements OnInit, OnDestroy {
  @ViewChild('groupMap', { static: false }) groupMap?: ElementRef<HTMLElement>;

  activeGroups: DeliveryGroup[] = [];
  pendingGroupables: GroupableDelivery[] = [];
  selectedGroupRef = '';
  selectedGroupDetails: GroupDetails | null = null;
  groupNotification: string | null = null;
  isLoading = false;
  mapMessage: string | null = null;

  private readonly transporteurId = this.requestService.getCurrentUserId();
  private readonly vehicleCapacityKg = Number(localStorage.getItem('vehicleCapacityKg') || '800');

  constructor(
    private requestService: DeliveryRequestService,
    private mapService: DeliveryMapService,
    private deliveryService: DeliveryExtendedService
  ) {}

  ngOnInit(): void {
    this.loadData();
    window.setTimeout(() => this.initMap(), 120);
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  createSuggestedGroup(): void {
    if (this.pendingGroupables.length < 2) {
      this.pushNotification('Not enough compatible requests to create a group.');
      return;
    }

    const seed = this.pendingGroupables[0];
    const selected: GroupableDelivery[] = [];
    let totalWeight = 0;

    for (const delivery of this.pendingGroupables) {
      const nearSeed = this.haversineKm(seed.latDepart, seed.lngDepart, delivery.latDepart, delivery.lngDepart) <= 55;
      const canFit = totalWeight + delivery.poids <= this.vehicleCapacityKg;
      if (nearSeed && canFit) {
        selected.push(delivery);
        totalWeight += delivery.poids;
      }
    }

    if (selected.length < 2) {
      this.pushNotification('No valid grouping with the current vehicle capacity.');
      return;
    }

    this.isLoading = true;
    this.deliveryService.createGroupFromDeliveries(this.transporteurId, selected.map((delivery) => delivery.id)).subscribe({
      next: (result) => {
        this.isLoading = false;
        if (!result?.groupReference) {
          this.pushNotification('The group could not be created.');
          return;
        }

        this.pushNotification(`Group ${result.groupReference} created with ${selected.length} deliveries.`);
        this.loadData(result.groupReference);
      },
      error: (err) => {
        this.isLoading = false;
        this.pushNotification(err?.error?.message || 'Error creating the group.');
      }
    });
  }

  showGroupOnMap(group: DeliveryGroup): void {
    this.selectedGroupRef = group.groupReference;
    this.mapMessage = 'Loading group route...';
    this.deliveryService.getGroupDetails(group.groupReference, this.transporteurId).subscribe({
      next: (details) => {
        this.selectedGroupDetails = details;
        this.renderSelectedGroupOnMap();
      },
      error: (err) => {
        console.error('Erreur lors du chargement de la route du groupe:', err);
        this.mapMessage = 'Unable to load the route for this group.';
      }
    });
  }

  getRecommendedOrder(group: DeliveryGroup): Array<{ id: string; distanceKm: number }> {
    const points = this.getRoutePointsForDisplay(group.groupReference);
    const result: Array<{ id: string; distanceKm: number }> = [];

    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const previous = points[index - 1];
      const distanceKm = previous
        ? this.haversineKm(previous.lat, previous.lng, current.lat, current.lng)
        : 0;

      result.push({
        id: current.label,
        distanceKm: Math.round(distanceKm * 10) / 10
      });
    }

    return result;
  }

  private loadData(groupToSelect?: string): void {
    this.loadGroups(groupToSelect);
    this.loadCandidates();
  }

  private loadGroups(groupToSelect?: string): void {
    this.deliveryService.getTransporterGroups(this.transporteurId).subscribe({
      next: (groups) => {
        this.activeGroups = groups;

        const targetRef = groupToSelect || this.selectedGroupRef || groups[0]?.groupReference;
        if (targetRef) {
          const target = groups.find((group) => group.groupReference === targetRef);
          if (target) {
            this.showGroupOnMap(target);
          }
        } else {
          this.selectedGroupRef = '';
          this.selectedGroupDetails = null;
          this.mapMessage = 'No group created yet.';
          this.mapService.clear();
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des groupes:', err);
        this.activeGroups = [];
        this.mapMessage = 'Unable to load the groups.';
      }
    });
  }

  private loadCandidates(): void {
    this.deliveryService.getDemandesEnCoursPourTransporteur(this.transporteurId, 'GROUPABLE').subscribe({
      next: (items) => {
        this.pendingGroupables = items
          .map((item) => item?.livraison)
          .filter((delivery: GroupableDelivery | null | undefined) => !!delivery && !delivery.grouped);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des livraisons regroupables:', err);
        this.pendingGroupables = [];
      }
    });
  }

  private initMap(): void {
    if (!this.groupMap) {
      return;
    }

    this.mapService.initMap(this.groupMap.nativeElement, 36.8065, 10.1815, 8);
    if (this.selectedGroupDetails) {
      this.renderSelectedGroupOnMap();
    } else {
      this.mapMessage = 'Select a group to display its route.';
    }
  }

  private renderSelectedGroupOnMap(): void {
    const map = this.mapService.getMap();
    if (!map) {
      return;
    }

    this.mapService.clear();
    const routePoints = this.getRoutePoints();
    if (routePoints.length < 2) {
      this.mapMessage = 'This group does not have enough points to display a route.';
      return;
    }

    routePoints.forEach((point, index) => {
      const isFirst = index === 0;
      const isLast = index === routePoints.length - 1;

      this.mapService.addMarker(
        point.lat,
        point.lng,
        point.label,
        { icon: this.mapService.getPointIcon(isFirst ? 'start' : 'end') }
      );

      if (!isFirst && !isLast && point.kind === 'stop') {
        this.mapService.addCircleMarker(point.lat, point.lng, 7, '#0ea5e9');
      }
    });

    this.mapService.drawChainedRouteOSRM(routePoints, '#00acc1', 5).then(() => {
      this.mapService.fitBounds(routePoints, 90);
      this.mapMessage = null;
      window.setTimeout(() => this.mapService.getMap()?.invalidateSize(), 150);
    });
  }

  private getRoutePoints(): GroupRoutePoint[] {
    return this.getRoutePointsForDisplay(this.selectedGroupRef);
  }

  private getRoutePointsForDisplay(groupReference: string): GroupRoutePoint[] {
    if (!this.selectedGroupDetails || this.selectedGroupDetails.groupReference !== groupReference) {
      return [];
    }

    const deliveries = (this.selectedGroupDetails.deliveries || []).filter((delivery: any) =>
      Number.isFinite(delivery?.latDepart) &&
      Number.isFinite(delivery?.lngDepart) &&
      Number.isFinite(delivery?.latArrivee) &&
      Number.isFinite(delivery?.lngArrivee)
    );

    if (deliveries.length >= 2) {
      const optimized = this.buildOptimizedGroupRoute(deliveries);
      if (optimized.length >= 2) return optimized;
    }

    if (this.selectedGroupDetails?.routePoints?.length) {
      return this.selectedGroupDetails.routePoints.filter((point) => this.isValidPoint(point));
    }

    return [];
  }

  private buildOptimizedGroupRoute(deliveries: any[]): GroupRoutePoint[] {
    const points: GroupRoutePoint[] = [];

    const nearestIndex = (list: any[], lat: number, lng: number, key: 'pickup' | 'dropoff'): number => {
      let bestIdx = -1;
      let bestDist = Infinity;
      list.forEach((delivery, idx) => {
        const dLat = Number(key === 'pickup' ? delivery.latDepart : delivery.latArrivee);
        const dLng = Number(key === 'pickup' ? delivery.lngDepart : delivery.lngArrivee);
        if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) return;
        const d = this.haversineKm(lat, lng, dLat, dLng);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      return bestIdx;
    };

    const pickups = [...deliveries];
    let currentLat = Number(pickups[0].latDepart);
    let currentLng = Number(pickups[0].lngDepart);

    const collected: any[] = [];
    while (pickups.length > 0) {
      const idx = nearestIndex(pickups, currentLat, currentLng, 'pickup');
      if (idx < 0) break;
      const [delivery] = pickups.splice(idx, 1);
      collected.push(delivery);
      currentLat = Number(delivery.latDepart);
      currentLng = Number(delivery.lngDepart);
      points.push({
        lat: currentLat,
        lng: currentLng,
        label: `${points.length + 1}. Pickup ${delivery.reference || 'Delivery'}`,
        kind: 'start'
      });
    }

    while (collected.length > 0) {
      const idx = nearestIndex(collected, currentLat, currentLng, 'dropoff');
      if (idx < 0) break;
      const [delivery] = collected.splice(idx, 1);
      currentLat = Number(delivery.latArrivee);
      currentLng = Number(delivery.lngArrivee);
      points.push({
        lat: currentLat,
        lng: currentLng,
        label: `${points.length + 1}. Delivery ${delivery.reference || 'Delivery'}`,
        kind: 'end'
      });
    }

    return points;
  }

  private isValidPoint(point: GroupRoutePoint | null | undefined): point is GroupRoutePoint {
    return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && (point.lat !== 0 || point.lng !== 0);
  }

  private pushNotification(message: string): void {
    this.groupNotification = message;
    window.setTimeout(() => (this.groupNotification = null), 3000);
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
}
