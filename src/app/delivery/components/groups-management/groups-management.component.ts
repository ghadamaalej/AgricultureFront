import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { DeliveryExtendedService, DeliveryGroup, GroupDetails, GroupRoutePoint } from '../../services/delivery-extended.service';
import { DeliveryMapService } from '../../services/delivery-map.service';

@Component({
  selector: 'app-groups-management',
  templateUrl: './groups-management.component.html',
  styleUrls: ['./groups-management.component.css']
})
export class GroupsManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('groupMap', { static: false }) groupMap?: ElementRef<HTMLElement>;

  @Input() transporteurId: number = 0;
  @Output() groupSelected = new EventEmitter<string>();
  @Output() deliverySelected = new EventEmitter<any>();

  groups: DeliveryGroup[] = [];
  selectedGroup: DeliveryGroup | null = null;
  groupDetails: GroupDetails | null = null;
  isLoading: boolean = false;
  showCreateGroupModal: boolean = false;
  selectedDeliveriesForGroup: number[] = [];
  editingGroupReference: string | null = null;
  feedbackMessage: string | null = null;
  feedbackType: 'success' | 'error' | 'info' | null = null;

  // Pour la création de groupe
  availableDeliveries: any[] = [];
  groupMapMessage: string | null = null;

  constructor(
    private deliveryService: DeliveryExtendedService,
    private mapService: DeliveryMapService
  ) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  ngAfterViewInit(): void {
    if (this.selectedGroup && this.groupDetails) {
      this.queueRenderSelectedGroupMap();
    }
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  loadGroups(): void {
    if (!this.transporteurId) return;
    
    this.isLoading = true;
    const selectedReference = this.selectedGroup?.groupReference || null;
    this.deliveryService.getTransporterGroups(this.transporteurId).subscribe({
      next: (groups) => {
        this.groups = groups;
        if (selectedReference) {
          this.selectedGroup = groups.find(group => group.groupReference === selectedReference) || null;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des groupes:', err);
        this.isLoading = false;
      }
    });
  }

  selectGroup(group: DeliveryGroup): void {
    this.selectedGroup = group;
    this.groupDetails = null;
    this.groupMapMessage = 'Loading group route...';
    this.loadGroupDetails(group.groupReference);
    this.groupSelected.emit(group.groupReference);
  }

  loadGroupDetails(groupReference: string): void {
    if (!this.transporteurId || !groupReference) return;
    
    this.deliveryService.getGroupDetails(groupReference, this.transporteurId).subscribe({
      next: (details) => {
        this.groupDetails = details;
        this.groupMapMessage = null;
        this.queueRenderSelectedGroupMap();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des détails du groupe:', err);
        this.groupMapMessage = 'Unable to load the route for this group.';
      }
    });
  }

  openCreateGroupModal(): void {
    this.showCreateGroupModal = true;
    this.editingGroupReference = null;
    this.loadAvailableDeliveries();
    this.selectedDeliveriesForGroup = [];
    this.clearFeedback();
  }

  closeCreateGroupModal(): void {
    this.showCreateGroupModal = false;
    this.selectedDeliveriesForGroup = [];
    this.editingGroupReference = null;
  }

  loadAvailableDeliveries(): void {
    this.deliveryService.getDemandesEnCoursPourTransporteur(this.transporteurId, 'GROUPABLE').subscribe({
      next: (deliveries) => {
        const mapped = deliveries
          .map(d => d.livraison)
          .filter((l: any) => l);
        const currentGroupDeliveries = this.groupDetails?.deliveries ?? [];
        const merged = [...mapped, ...currentGroupDeliveries];
        this.availableDeliveries = merged.filter((delivery: any, index: number, all: any[]) =>
          all.findIndex(candidate => candidate?.id === delivery?.id) === index
        ).filter((delivery: any) =>
          !delivery.grouped || delivery.groupReference === this.editingGroupReference
        );
      },
      error: (err) => {
        console.error('Erreur lors du chargement des livraisons disponibles:', err);
        this.showFeedback('Unable to load available deliveries.', 'error');
      }
    });
  }

  toggleDeliverySelection(deliveryId: number): void {
    const index = this.selectedDeliveriesForGroup.indexOf(deliveryId);
    if (index > -1) {
      this.selectedDeliveriesForGroup.splice(index, 1);
    } else {
      this.selectedDeliveriesForGroup.push(deliveryId);
    }
  }

  isDeliverySelected(deliveryId: number): boolean {
    return this.selectedDeliveriesForGroup.includes(deliveryId);
  }

  createGroup(): void {
    if (this.selectedDeliveriesForGroup.length < 2) {
      this.showFeedback('Please select at least 2 deliveries to form a group.', 'error');
      return;
    }

    this.isLoading = true;
    const request$ = this.editingGroupReference
      ? this.deliveryService.updateGroupDeliveries(this.transporteurId, this.editingGroupReference, this.selectedDeliveriesForGroup)
      : this.deliveryService.createGroupFromDeliveries(this.transporteurId, this.selectedDeliveriesForGroup);

    request$.subscribe({
      next: (result) => {
        this.isLoading = false;
        if (!result) {
          this.showFeedback('Group save failed.', 'error');
          return;
        }
        const targetReference = result.groupReference || this.editingGroupReference;
        this.closeCreateGroupModal();
        this.selectedGroup = targetReference
          ? ({ groupReference: targetReference } as DeliveryGroup)
          : this.selectedGroup;
        this.loadGroups();
        this.showFeedback(result.message || 'Group saved successfully.', 'success');
        if (targetReference) {
          this.groupMapMessage = 'Loading group route...';
          this.loadGroupDetails(targetReference);
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erreur lors de la création du groupe:', err);
        this.showFeedback('Error saving the group.', 'error');
      }
    });
  }

  openEditGroupModal(): void {
    if (!this.selectedGroup || !this.groupDetails) {
      this.showFeedback('Please select a group to edit first.', 'info');
      return;
    }

    this.editingGroupReference = this.selectedGroup.groupReference;
    this.selectedDeliveriesForGroup = this.groupDetails.deliveries
      .map((delivery: any) => Number(delivery.id))
      .filter((id: number) => Number.isFinite(id));
    this.showCreateGroupModal = true;
    this.clearFeedback();
    this.loadAvailableDeliveries();
  }

  deleteSelectedGroup(): void {
    if (!this.selectedGroup) {
      this.showFeedback('Please select a group to delete first.', 'info');
      return;
    }

    const groupReference = this.selectedGroup.groupReference;
    this.isLoading = true;
    this.deliveryService.deleteGroup(this.transporteurId, groupReference).subscribe({
      next: (result) => {
        this.isLoading = false;
        if (!result) {
          this.showFeedback('Group deletion failed.', 'error');
          return;
        }
        this.showFeedback(result.message || 'Group deleted successfully.', 'success');
        this.closeSelectedGroup();
        this.loadGroups();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erreur lors de la suppression du groupe:', err);
        this.showFeedback('Error deleting the group.', 'error');
      }
    });
  }

  selectDelivery(delivery: any): void {
    this.deliverySelected.emit(delivery);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(price);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('fr-FR').format(num);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'EN_ATTENTE': '#FF9800',
      'ACCEPTEE': '#4CAF50',
      'EN_COURS': '#2196F3',
      'RETARD': '#F44336',
      'LIVREE': '#8BC34A',
      'ANNULEE': '#9E9E9E'
    };
    return colors[status] || '#9E9E9E';
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'EN_ATTENTE': 'Pending',
      'ACCEPTEE': 'Accepted',
      'EN_COURS': 'In progress',
      'RETARD': 'Delayed',
      'LIVREE': 'Delivered',
      'ANNULEE': 'Cancelled'
    };
    return texts[status] || status;
  }

  getGroupStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'COMPLETED': '#10b981',
      'IN_PROGRESS': '#3b82f6',
      'PENDING': '#f59e0b'
    };
    return colors[status] || '#6b7280';
  }

  getGroupStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'COMPLETED': 'Completed',
      'IN_PROGRESS': 'In progress',
      'PENDING': 'Pending'
    };
    return texts[status] || status;
  }

  getTotalSavings(): number {
    return this.groups.reduce((total, group) => total + group.savings, 0);
  }

  getTotalGroups(): number {
    return this.groups.length;
  }

  getCompletedGroups(): number {
    return this.groups.filter(g => g.status === 'COMPLETED').length;
  }

  getInProgressGroups(): number {
    return this.groups.filter(g => g.status === 'IN_PROGRESS').length;
  }

  getSelectedDeliveriesWeight(): number {
    return this.selectedDeliveriesForGroup.reduce((sum, id) => {
      const delivery = this.availableDeliveries.find(d => d.id === id);
      return sum + (delivery?.poids || 0);
    }, 0);
  }

  getStatusEntries(): [string, number][] {
    return this.groupDetails?.statusCount ? Object.entries(this.groupDetails.statusCount) : [];
  }

  closeSelectedGroup(): void {
    this.selectedGroup = null;
    this.groupDetails = null;
    this.groupMapMessage = null;
    this.mapService.destroy();
  }

  getModalTitle(): string {
    return this.editingGroupReference ? `Edit group ${this.editingGroupReference}` : 'Create a new group';
  }

  getModalActionLabel(): string {
    if (this.isLoading) {
      return this.editingGroupReference ? 'Updating...' : 'Creating...';
    }
    return this.editingGroupReference ? 'Update group' : 'Create group';
  }

  private showFeedback(message: string, type: 'success' | 'error' | 'info'): void {
    this.feedbackMessage = message;
    this.feedbackType = type;
  }

  private clearFeedback(): void {
    this.feedbackMessage = null;
    this.feedbackType = null;
  }

  private renderSelectedGroupMap(): void {
    const routePoints = this.getRoutePoints();
    if (!this.groupMap) {
      return;
    }

    if (routePoints.length < 2) {
      this.groupMapMessage = 'This group does not have enough coordinates to display the route.';
      this.mapService.destroy();
      return;
    }

    const firstPoint = routePoints[0];
    if (!this.mapService.getMap()) {
      this.mapService.initMap(this.groupMap.nativeElement, firstPoint.lat, firstPoint.lng, 9);
    } else {
      this.mapService.getMap()?.invalidateSize();
    }

    this.mapService.clear();
    routePoints.forEach((point, index) => {
      const isFirst = index === 0;
      const isLast = index === routePoints.length - 1;
      this.mapService.addMarker(
        point.lat,
        point.lng,
        point.label,
        { icon: this.mapService.getPointIcon(point.kind === 'start' ? 'start' : 'end') }
      );

      if (!isFirst && !isLast && point.kind === 'stop') {
        this.mapService.addCircleMarker(point.lat, point.lng, 7, '#0ea5e9');
      }
    });

    this.mapService.drawRouteOSRM(routePoints, '#0f766e', 5).then(() => {
      this.mapService.fitBounds(routePoints, 80);
      this.groupMapMessage = null;
      window.setTimeout(() => this.mapService.getMap()?.invalidateSize(), 150);
    });
  }

  private queueRenderSelectedGroupMap(attempt: number = 0): void {
    const maxAttempts = 8;
    window.setTimeout(() => {
      if (!this.groupMap) {
        if (attempt < maxAttempts) {
          this.queueRenderSelectedGroupMap(attempt + 1);
        }
        return;
      }
      this.renderSelectedGroupMap();
    }, attempt === 0 ? 0 : 120);
  }

  private getRoutePoints(): GroupRoutePoint[] {
    const backendPoints = (this.groupDetails?.routePoints || []).filter((point) => this.isValidPoint(point));
    const fallbackPoints = this.buildOptimizedRoutePointsFromDeliveries(this.groupDetails?.deliveries || []);

    if (backendPoints.length >= fallbackPoints.length && backendPoints.length >= 2) {
      return backendPoints;
    }

    return fallbackPoints;
  }

  private buildOptimizedRoutePointsFromDeliveries(deliveries: any[]): GroupRoutePoint[] {
    const validDeliveries = deliveries.filter((delivery) =>
      this.isFiniteCoordinate(delivery.latDepart) &&
      this.isFiniteCoordinate(delivery.lngDepart) &&
      this.isFiniteCoordinate(delivery.latArrivee) &&
      this.isFiniteCoordinate(delivery.lngArrivee)
    );

    if (!validDeliveries.length) {
      return [];
    }

    const pendingPickups = [...validDeliveries];
    const picked: any[] = [];
    const completed = new Set<number>();
    const points: GroupRoutePoint[] = [];
    const pickupClusterThresholdKm = 8;

    let currentLat = Number(pendingPickups[0].latDepart);
    let currentLng = Number(pendingPickups[0].lngDepart);

    while (completed.size < validDeliveries.length) {
      if (!picked.length) {
        const nextPickup = this.takeNearestPickup(pendingPickups, currentLat, currentLng);
        if (!nextPickup) break;
        points.push({
          lat: Number(nextPickup.latDepart),
          lng: Number(nextPickup.lngDepart),
          label: `${points.length + 1}. Pickup ${nextPickup.reference || 'Delivery'} - departure`,
          kind: 'start'
        });
        picked.push(nextPickup);
        currentLat = Number(nextPickup.latDepart);
        currentLng = Number(nextPickup.lngDepart);
        continue;
      }

      const nearestPickup = this.peekNearestPickup(pendingPickups, currentLat, currentLng);
      const nearestDropoff = this.peekNearestDropoff(picked, currentLat, currentLng);
      if (!nearestDropoff) break;

      let shouldPickup = false;
      if (nearestPickup) {
        const distanceToPickup = this.haversineKm(currentLat, currentLng, Number(nearestPickup.latDepart), Number(nearestPickup.lngDepart));
        if (distanceToPickup <= pickupClusterThresholdKm) {
          shouldPickup = true;
        } else {
          const deliverThenPickup = nearestDropoff.distance + this.distanceFromDropoffToNearestPickup(nearestDropoff.delivery, pendingPickups);
          const pickupThenDeliver = distanceToPickup + this.distanceFromPickupToNearestDropoff(nearestPickup, picked);
          shouldPickup = pickupThenDeliver < deliverThenPickup;
        }
      }

      if (shouldPickup && nearestPickup) {
        const pickedDelivery = this.takeSpecificDelivery(pendingPickups, nearestPickup);
        if (!pickedDelivery) continue;
        points.push({
          lat: Number(pickedDelivery.latDepart),
          lng: Number(pickedDelivery.lngDepart),
          label: `${points.length + 1}. Pickup ${pickedDelivery.reference || 'Delivery'} - departure`,
          kind: 'start'
        });
        picked.push(pickedDelivery);
        currentLat = Number(pickedDelivery.latDepart);
        currentLng = Number(pickedDelivery.lngDepart);
      } else {
        const delivered = this.takeSpecificDelivery(picked, nearestDropoff.delivery);
        if (!delivered) continue;
        points.push({
          lat: Number(delivered.latArrivee),
          lng: Number(delivered.lngArrivee),
          label: `${points.length + 1}. Delivery ${delivered.reference || 'Delivery'} - arrival`,
          kind: 'stop'
        });
        completed.add(Number(delivered.id));
        currentLat = Number(delivered.latArrivee);
        currentLng = Number(delivered.lngArrivee);
      }
    }

    return points.filter((point) => this.isValidPoint(point));
  }

  private peekNearestPickup(pool: any[], lat: number, lng: number): any | null {
    if (!pool.length) return null;
    return [...pool].sort((a, b) =>
      this.haversineKm(lat, lng, Number(a.latDepart), Number(a.lngDepart)) -
      this.haversineKm(lat, lng, Number(b.latDepart), Number(b.lngDepart))
    )[0];
  }

  private takeNearestPickup(pool: any[], lat: number, lng: number): any | null {
    const nearest = this.peekNearestPickup(pool, lat, lng);
    return nearest ? this.takeSpecificDelivery(pool, nearest) : null;
  }

  private peekNearestDropoff(pool: any[], lat: number, lng: number): { delivery: any; distance: number } | null {
    if (!pool.length) return null;
    const sorted = [...pool].map((delivery) => ({
      delivery,
      distance: this.haversineKm(lat, lng, Number(delivery.latArrivee), Number(delivery.lngArrivee))
    })).sort((a, b) => a.distance - b.distance);
    return sorted[0] || null;
  }

  private takeSpecificDelivery(pool: any[], target: any): any | null {
    const index = pool.findIndex((delivery) => Number(delivery.id) === Number(target.id));
    if (index < 0) return null;
    return pool.splice(index, 1)[0];
  }

  private distanceFromDropoffToNearestPickup(from: any, pickups: any[]): number {
    if (!pickups.length) return 0;
    return Math.min(...pickups.map((delivery) =>
      this.haversineKm(Number(from.latArrivee), Number(from.lngArrivee), Number(delivery.latDepart), Number(delivery.lngDepart))
    ));
  }

  private distanceFromPickupToNearestDropoff(from: any, picked: any[]): number {
    if (!picked.length) return 0;
    return Math.min(...picked.map((delivery) =>
      this.haversineKm(Number(from.latDepart), Number(from.lngDepart), Number(delivery.latArrivee), Number(delivery.lngArrivee))
    ));
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

  private isValidPoint(point: GroupRoutePoint | null | undefined): point is GroupRoutePoint {
    return !!point && this.isFiniteCoordinate(point.lat) && this.isFiniteCoordinate(point.lng);
  }

  private isFiniteCoordinate(value: unknown): boolean {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue !== 0;
  }
}
