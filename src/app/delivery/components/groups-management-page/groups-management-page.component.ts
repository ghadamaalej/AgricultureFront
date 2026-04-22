import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryMapService } from '../../services/delivery-map.service';
import { DeliveryRequest, DeliveryRequestService } from '../../services/delivery-request.service';

type FarmerGroupedDelivery = DeliveryRequest & {
  discountAmount: number;
  estimatedBeforeDiscount: number;
  routeDistanceFromPreviousKm: number;
  estimatedArrivalTime: string;
  estimatedServiceMinutes: number;
  stopOrder: number;
};

type FarmerGroupSummary = {
  groupReference: string;
  deliveries: FarmerGroupedDelivery[];
  totalPriceAfterDiscount: number;
  totalPriceBeforeDiscount: number;
  totalDiscount: number;
  totalEstimatedMinutes: number;
  totalDistanceKm: number;
  totalStops: number;
};

type RoutePoint = {
  lat: number;
  lng: number;
  label: string;
  kind: 'start' | 'stop';
};

type PlannedStep = {
  delivery: DeliveryRequest;
  phase: 'pickup' | 'dropoff';
};

@Component({
  selector: 'app-groups-management-page',
  templateUrl: './groups-management-page.component.html',
  styleUrls: ['./groups-management-page.component.css']
})
export class GroupsManagementPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('farmerGroupMap', { static: false }) farmerGroupMap?: ElementRef<HTMLElement>;

  currentUserId: number = 0;
  readonly isFarmer = this.deliveryService.isUserFarmerRole();
  farmerGroups: FarmerGroupSummary[] = [];
  selectedFarmerGroup: FarmerGroupSummary | null = null;
  farmerMapMessage: string | null = null;

  constructor(
    private deliveryService: DeliveryRequestService,
    private mapService: DeliveryMapService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.deliveryService.getCurrentUserId();
    if (this.isFarmer) {
      this.deliveryService.refreshFromBackend().subscribe(() => {
        this.buildFarmerGroups();
        this.selectedFarmerGroup = this.farmerGroups[0] || null;
        if (this.selectedFarmerGroup) {
          this.farmerMapMessage = 'Chargement de la route du groupe...';
          window.setTimeout(() => this.renderFarmerGroupMap(), 0);
        }
      });
    }
  }

  ngAfterViewInit(): void {
    if (this.isFarmer) {
      window.setTimeout(() => this.renderFarmerGroupMap(), 0);
    }
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  onGroupSelected(groupReference: string): void {
    void groupReference;
  }

  onDeliverySelected(delivery: any): void {
    const deliveryId = delivery?.id ?? delivery?.livraisonId;
    if (deliveryId) {
      this.router.navigate(['/delivery/livraisons', deliveryId]);
    }
  }

  selectFarmerGroup(group: FarmerGroupSummary): void {
    this.selectedFarmerGroup = group;
    this.farmerMapMessage = 'Chargement de la route du groupe...';
    window.setTimeout(() => this.renderFarmerGroupMap(), 0);
  }

  getTotalGroupsCount(): number {
    return this.farmerGroups.length;
  }

  getGlobalAfterDiscount(): number {
    return this.round2(this.farmerGroups.reduce((sum, group) => sum + group.totalPriceAfterDiscount, 0));
  }

  getGlobalBeforeDiscount(): number {
    return this.round2(this.farmerGroups.reduce((sum, group) => sum + group.totalPriceBeforeDiscount, 0));
  }

  getGlobalEstimatedMinutes(): number {
    return this.farmerGroups.reduce((sum, group) => sum + group.totalEstimatedMinutes, 0);
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return 'Non précisée';
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

  formatDuration(minutes: number): string {
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safeMinutes / 60);
    const remaining = safeMinutes % 60;
    if (hours <= 0) {
      return `${remaining} min`;
    }
    return `${hours}h${String(remaining).padStart(2, '0')}`;
  }

  private buildFarmerGroups(): void {
    const deliveries = this.deliveryService.getForCurrentFarmer()
      .filter((delivery) => delivery.grouped && delivery.groupReference);

    const groupedMap = new Map<string, DeliveryRequest[]>();
    deliveries.forEach((delivery) => {
      const key = delivery.groupReference as string;
      const existing = groupedMap.get(key) || [];
      existing.push(delivery);
      groupedMap.set(key, existing);
    });

    this.farmerGroups = Array.from(groupedMap.entries())
      .map(([groupReference, groupDeliveries]) => this.toFarmerGroupSummary(groupReference, groupDeliveries))
      .sort((left, right) => right.deliveries.length - left.deliveries.length);
  }

  private toFarmerGroupSummary(groupReference: string, deliveries: DeliveryRequest[]): FarmerGroupSummary {
    const ordered = this.optimizeGroupDeliveries(deliveries);
    const routePoints = this.buildRoutePointsFromDeliveries(ordered);

    let currentLat = ordered[0]?.pickupLat || 0;
    let currentLng = ordered[0]?.pickupLng || 0;
    let rollingTime = new Date(ordered[0]?.plannedDeliveryDate || ordered[0]?.departureDate || ordered[0]?.createdAt || Date.now());

    const enrichedDeliveries = ordered.map((delivery, index) => {
      const estimatedBeforeDiscount = this.round2(delivery.estimatedPrice / 0.75);
      const discountAmount = this.round2(estimatedBeforeDiscount - delivery.estimatedPrice);
      const toPickupKm = this.haversineKm(currentLat, currentLng, delivery.pickupLat, delivery.pickupLng);
      const pickupToDropoffKm = this.haversineKm(delivery.pickupLat, delivery.pickupLng, delivery.dropoffLat, delivery.dropoffLng);
      const routeDistanceFromPreviousKm = this.round2(index === 0 ? pickupToDropoffKm : toPickupKm + pickupToDropoffKm);
      const estimatedDriveMinutes = routeDistanceFromPreviousKm > 0 ? (routeDistanceFromPreviousKm / 45) * 60 : 0;
      const estimatedServiceMinutes = this.round2(index === 0 ? 50 : 50 + estimatedDriveMinutes);
      rollingTime = new Date(rollingTime.getTime() + estimatedServiceMinutes * 60000);

      currentLat = delivery.dropoffLat;
      currentLng = delivery.dropoffLng;

      return {
        ...delivery,
        estimatedBeforeDiscount,
        discountAmount,
        routeDistanceFromPreviousKm,
        estimatedServiceMinutes,
        estimatedArrivalTime: rollingTime.toISOString(),
        stopOrder: index + 1
      };
    });

    return {
      groupReference,
      deliveries: enrichedDeliveries,
      totalPriceAfterDiscount: this.round2(enrichedDeliveries.reduce((sum, delivery) => sum + delivery.estimatedPrice, 0)),
      totalPriceBeforeDiscount: this.round2(enrichedDeliveries.reduce((sum, delivery) => sum + delivery.estimatedBeforeDiscount, 0)),
      totalDiscount: this.round2(enrichedDeliveries.reduce((sum, delivery) => sum + delivery.discountAmount, 0)),
      totalEstimatedMinutes: this.round2(enrichedDeliveries.reduce((sum, delivery) => sum + delivery.estimatedServiceMinutes, 0)),
      totalDistanceKm: this.round2(this.computeRouteDistanceKm(routePoints)),
      totalStops: routePoints.length
    };
  }

  private renderFarmerGroupMap(): void {
    if (!this.isFarmer || !this.selectedFarmerGroup || !this.farmerGroupMap) {
      return;
    }

    const routePoints = this.buildRoutePoints(this.selectedFarmerGroup);
    if (routePoints.length < 2) {
      this.farmerMapMessage = 'Pas assez de points pour afficher la route du groupe.';
      return;
    }

    if (!this.mapService.getMap()) {
      this.mapService.initMap(this.farmerGroupMap.nativeElement, routePoints[0].lat, routePoints[0].lng, 9);
    }

    this.mapService.clear();
    routePoints.forEach((point, index) => {
      this.mapService.addMarker(
        point.lat,
        point.lng,
        point.label,
        { icon: this.mapService.getPointIcon(point.kind === 'start' ? 'start' : 'end') }
      );
      if (index > 0 && index < routePoints.length - 1) {
        this.mapService.addCircleMarker(point.lat, point.lng, 7, '#0ea5e9');
      }
    });

    this.mapService.drawRouteOSRM(routePoints, '#00acc1', 5).then(() => {
      this.mapService.fitBounds(routePoints, 90);
      this.farmerMapMessage = null;
      window.setTimeout(() => this.mapService.getMap()?.invalidateSize(), 120);
    });
  }

  private buildRoutePoints(group: FarmerGroupSummary): RoutePoint[] {
    return this.buildRoutePointsFromDeliveries(group.deliveries);
  }

  private buildRoutePointsFromDeliveries(deliveries: DeliveryRequest[]): RoutePoint[] {
    const steps = this.planGroupSteps(deliveries);
    const points: RoutePoint[] = steps.map((step, index) => {
      const isPickup = step.phase === 'pickup';
      const lat = isPickup ? step.delivery.pickupLat : step.delivery.dropoffLat;
      const lng = isPickup ? step.delivery.pickupLng : step.delivery.dropoffLng;
      const label = isPickup
        ? `${index + 1}. Collecte ${step.delivery.reference} - ${step.delivery.pickupLabel}`
        : `${index + 1}. Livraison ${step.delivery.reference} - ${step.delivery.dropoffLabel}`;

      return {
        lat,
        lng,
        label,
        kind: isPickup ? 'start' : 'stop'
      };
    });

    return points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  private optimizeGroupDeliveries(deliveries: DeliveryRequest[]): DeliveryRequest[] {
    const steps = this.planGroupSteps(deliveries);
    const dropoffOrder = steps
      .filter((step) => step.phase === 'dropoff')
      .map((step) => step.delivery);

    return dropoffOrder.length ? dropoffOrder : [...deliveries];
  }

  private planGroupSteps(deliveries: DeliveryRequest[]): PlannedStep[] {
    const validDeliveries = deliveries.filter((delivery) =>
      Number.isFinite(delivery.pickupLat) &&
      Number.isFinite(delivery.pickupLng) &&
      Number.isFinite(delivery.dropoffLat) &&
      Number.isFinite(delivery.dropoffLng)
    );

    if (!validDeliveries.length) {
      return [];
    }

    const departureSorted = [...validDeliveries].sort((left, right) => {
      const leftDate = new Date(left.departureDate || left.plannedDeliveryDate || left.createdAt).getTime();
      const rightDate = new Date(right.departureDate || right.plannedDeliveryDate || right.createdAt).getTime();
      return leftDate - rightDate;
    });

    const pendingPickups = [...departureSorted];
    const picked: DeliveryRequest[] = [];
    const completed: DeliveryRequest[] = [];
    const steps: PlannedStep[] = [];

    let currentLat = pendingPickups[0].pickupLat;
    let currentLng = pendingPickups[0].pickupLng;
    const pickupClusterThresholdKm = 8;

    while (completed.length < departureSorted.length) {
      if (!picked.length) {
        const firstPickup = this.takeNearestPickup(pendingPickups, currentLat, currentLng);
        if (!firstPickup) {
          break;
        }
        steps.push({ delivery: firstPickup, phase: 'pickup' });
        picked.push(firstPickup);
        currentLat = firstPickup.pickupLat;
        currentLng = firstPickup.pickupLng;
        continue;
      }

      const nearestPickup = this.peekNearestPickup(pendingPickups, currentLat, currentLng);
      const nearestDropoff = this.peekNearestDropoff(picked, currentLat, currentLng);

      if (!nearestDropoff) {
        break;
      }

      let shouldCollectNext = false;
      if (nearestPickup) {
        const distanceToPickup = this.haversineKm(currentLat, currentLng, nearestPickup.pickupLat, nearestPickup.pickupLng);
        if (distanceToPickup <= pickupClusterThresholdKm) {
          shouldCollectNext = true;
        } else {
          const deliverThenPickup = nearestDropoff.distance + this.distanceFromDropoffToNearestPickup(nearestDropoff.delivery, pendingPickups);
          const pickupThenDeliver = distanceToPickup + this.distanceFromPickupToNearestDropoff(nearestPickup, picked);
          shouldCollectNext = pickupThenDeliver < deliverThenPickup;
        }
      }

      if (shouldCollectNext && nearestPickup) {
        const pickedDelivery = this.takeSpecificPickup(pendingPickups, nearestPickup);
        if (!pickedDelivery) {
          continue;
        }
        steps.push({ delivery: pickedDelivery, phase: 'pickup' });
        picked.push(pickedDelivery);
        currentLat = pickedDelivery.pickupLat;
        currentLng = pickedDelivery.pickupLng;
      } else {
        const delivered = this.takeSpecificPicked(picked, nearestDropoff.delivery);
        if (!delivered) {
          continue;
        }
        steps.push({ delivery: delivered, phase: 'dropoff' });
        completed.push(delivered);
        currentLat = delivered.dropoffLat;
        currentLng = delivered.dropoffLng;
      }
    }

    return steps;
  }

  private peekNearestPickup(pool: DeliveryRequest[], lat: number, lng: number): DeliveryRequest | null {
    if (!pool.length) return null;
    return [...pool].sort((a, b) =>
      this.haversineKm(lat, lng, a.pickupLat, a.pickupLng) - this.haversineKm(lat, lng, b.pickupLat, b.pickupLng)
    )[0];
  }

  private takeNearestPickup(pool: DeliveryRequest[], lat: number, lng: number): DeliveryRequest | null {
    const nearest = this.peekNearestPickup(pool, lat, lng);
    return nearest ? this.takeSpecificPickup(pool, nearest) : null;
  }

  private takeSpecificPickup(pool: DeliveryRequest[], target: DeliveryRequest): DeliveryRequest | null {
    const index = pool.findIndex((delivery) => delivery.id === target.id);
    if (index < 0) return null;
    return pool.splice(index, 1)[0];
  }

  private peekNearestDropoff(pool: DeliveryRequest[], lat: number, lng: number): { delivery: DeliveryRequest; distance: number } | null {
    if (!pool.length) return null;
    const sorted = [...pool].map((delivery) => ({
      delivery,
      distance: this.haversineKm(lat, lng, delivery.dropoffLat, delivery.dropoffLng)
    })).sort((a, b) => a.distance - b.distance);
    return sorted[0] || null;
  }

  private takeSpecificPicked(pool: DeliveryRequest[], target: DeliveryRequest): DeliveryRequest | null {
    const index = pool.findIndex((delivery) => delivery.id === target.id);
    if (index < 0) return null;
    return pool.splice(index, 1)[0];
  }

  private distanceFromDropoffToNearestPickup(from: DeliveryRequest, pickups: DeliveryRequest[]): number {
    if (!pickups.length) return 0;
    return Math.min(...pickups.map((delivery) =>
      this.haversineKm(from.dropoffLat, from.dropoffLng, delivery.pickupLat, delivery.pickupLng)
    ));
  }

  private distanceFromPickupToNearestDropoff(from: DeliveryRequest, picked: DeliveryRequest[]): number {
    if (!picked.length) return 0;
    return Math.min(...picked.map((delivery) =>
      this.haversineKm(from.pickupLat, from.pickupLng, delivery.dropoffLat, delivery.dropoffLng)
    ));
  }

  private computeRouteDistanceKm(points: RoutePoint[]): number {
    if (points.length < 2) {
      return 0;
    }
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      total += this.haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    }
    return total;
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const radius = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
