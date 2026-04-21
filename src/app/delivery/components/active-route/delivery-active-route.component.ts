import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DeliveryMapService, RouteGuidance } from '../../services/delivery-map.service';
import { DeliveryRequest, DeliveryRequestService } from '../../services/delivery-request.service';

type RoutePhase = 'pickup' | 'dropoff';

@Component({
  selector: 'app-delivery-active-route',
  standalone: false,
  templateUrl: './delivery-active-route.component.html',
  styleUrls: ['./delivery-active-route.component.css']
})
export class DeliveryActiveRouteComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer?: ElementRef;

  request: DeliveryRequest | null = null;
  phase: RoutePhase = 'pickup';
  guidance: RouteGuidance | null = null;
  loadingRoute = true;
  error: string | null = null;
  notification: string | null = null;
  currentPosition: { lat: number; lng: number } | null = null;
  livePositionEnabled = false;
  switchingPhase = false;
  finishing = false;

  private watchId: number | null = null;
  private lastGpsSyncAt = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mapService: DeliveryMapService,
    private requestService: DeliveryRequestService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const requestId = params.get('id') || '';
      if (!requestId) {
        this.error = 'Delivery not found.';
        return;
      }
      this.loadRequest(requestId);
    });
  }

  ngOnDestroy(): void {
    this.stopLiveTracking();
    this.mapService.destroy();
  }

  get phaseTitle(): string {
    return this.phase === 'pickup'
      ? 'Navigation to pickup point'
      : 'Navigation to final destination';
  }

  get phaseSubtitle(): string {
    if (!this.request) {
      return '';
    }
    return this.phase === 'pickup'
      ? `Follow the route to pick up the delivery at ${this.request.pickupLabel}.`
      : `Package loaded. Follow the route to ${this.request.dropoffLabel}.`;
  }

  goBack(): void {
    this.router.navigate(['/delivery/active']);
  }

  confirmPickupAndStartDelivery(): void {
    if (!this.request || this.switchingPhase) {
      return;
    }

    this.switchingPhase = true;
    this.phase = 'dropoff';
    localStorage.setItem(this.getPhaseStorageKey(this.request.id), this.phase);

    this.requestService.updateStatusApi(this.request.id, 'En cours').subscribe(() => {
      this.switchingPhase = false;
      this.notification = 'Pickup confirmed. Route updated towards the destination.';
      window.setTimeout(() => (this.notification = null), 2600);
      this.renderRoute();
    });
  }

  markAsDelivered(): void {
    if (!this.request || this.finishing) {
      return;
    }

    const requestId = this.request.id;
    this.finishing = true;
    this.requestService.updateStatusApi(requestId, 'Livrée').subscribe((updated) => {
      this.finishing = false;
      if (!updated) {
        this.notification = 'Unable to finalize this delivery at the moment.';
        window.setTimeout(() => (this.notification = null), 3000);
        return;
      }

      localStorage.removeItem(this.getPhaseStorageKey(requestId));
      this.router.navigate(['/delivery/active']);
    });
  }

  private loadRequest(requestId: string): void {
    this.stopLiveTracking();
    this.loadingRoute = true;
    this.error = null;

    this.requestService.refreshFromBackend().subscribe(() => {
      const found = this.requestService.getById(requestId);
      if (!found) {
        this.request = null;
        this.loadingRoute = false;
        this.error = 'Delivery not found.';
        return;
      }

      this.request = found;
      this.phase = this.resolveInitialPhase(found);
      this.currentPosition = this.resolveFallbackPosition(found);

      window.setTimeout(() => {
        this.initializeMap();
        this.renderRoute();
      }, 80);

      this.startLiveTracking();
    });
  }

  private resolveInitialPhase(request: DeliveryRequest): RoutePhase {
    const saved = localStorage.getItem(this.getPhaseStorageKey(request.id));
    if (saved === 'pickup' || saved === 'dropoff') {
      return saved;
    }

    if (request.status === 'Livrée') {
      return 'dropoff';
    }

    if (request.status === 'En cours') {
      return 'pickup';
    }

    return 'pickup';
  }

  private initializeMap(): void {
    if (!this.mapContainer || !this.currentPosition) {
      return;
    }

    this.mapService.initMap(
      this.mapContainer.nativeElement,
      this.currentPosition.lat,
      this.currentPosition.lng,
      11
    );
  }

  private startLiveTracking(): void {
    if (!this.request) {
      return;
    }

    if (!navigator.geolocation) {
      this.livePositionEnabled = false;
      this.renderRoute();
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.livePositionEnabled = true;
        this.applyNewPosition(position.coords.latitude, position.coords.longitude);
      },
      () => {
        this.livePositionEnabled = false;
        if (!this.currentPosition && this.request) {
          const fallback = this.resolveFallbackPosition(this.request);
          this.applyNewPosition(fallback.lat, fallback.lng);
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }

  private stopLiveTracking(): void {
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
  }

  private applyNewPosition(lat: number, lng: number): void {
    this.currentPosition = { lat, lng };

    if (this.request && Date.now() - this.lastGpsSyncAt > 5000) {
      this.lastGpsSyncAt = Date.now();
      this.requestService.updateCurrentPosition(this.request.id, lat, lng).subscribe();
    }

    this.renderRoute();
  }

  private renderRoute(): void {
    if (!this.request || !this.currentPosition || !this.mapContainer) {
      this.loadingRoute = false;
      return;
    }

    if (!this.mapService.getMap()) {
      this.initializeMap();
    }

    const destination = this.phase === 'pickup'
      ? { lat: this.request.pickupLat, lng: this.request.pickupLng }
      : { lat: this.request.dropoffLat, lng: this.request.dropoffLng };

    const points = [this.currentPosition, destination];

    this.mapService.clear();
    this.mapService.addMarker(this.currentPosition.lat, this.currentPosition.lng, '<strong>Current position</strong>', {
      title: 'Current position',
      icon: this.mapService.getPointIcon('start')
    });

    this.mapService.addMarker(destination.lat, destination.lng, this.phase === 'pickup'
      ? `<strong>Pickup:</strong> ${this.request.pickupLabel}`
      : `<strong>Destination:</strong> ${this.request.dropoffLabel}`,
      {
        title: this.phase === 'pickup' ? 'Pickup point' : 'Final destination',
        icon: this.mapService.getPointIcon('end')
      }
    );

    this.loadingRoute = true;
    this.error = null;

    this.mapService.drawRouteOSRM(points, this.phase === 'pickup' ? '#2563eb' : '#16a34a', 5)
      .then(() => this.mapService.fitBounds(points, 70));

    this.mapService.getRouteGuidance(points)
      .then((guidance) => {
        this.guidance = guidance;
        this.loadingRoute = false;
        if (!guidance) {
          this.error = 'Unable to calculate the route at the moment.';
        }
      })
      .catch(() => {
        this.loadingRoute = false;
        this.error = 'Unable to calculate the route at the moment.';
      });
  }

  private resolveFallbackPosition(request: DeliveryRequest): { lat: number; lng: number } {
    if (request.currentLat && request.currentLng) {
      return { lat: request.currentLat, lng: request.currentLng };
    }

    return this.phase === 'pickup'
      ? { lat: request.pickupLat, lng: request.pickupLng }
      : { lat: request.dropoffLat, lng: request.dropoffLng };
  }

  private getPhaseStorageKey(requestId: string): string {
    return `deliveryRoutePhase:${requestId}`;
  }
}

