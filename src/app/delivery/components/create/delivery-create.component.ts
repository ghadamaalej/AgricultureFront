import { Component, ElementRef, ViewChild, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { DeliveryMapService } from '../../services/delivery-map.service';
import { DeliveryRequestService, FarmerKnownTransporter } from '../../services/delivery-request.service';
import { FarmerChatbotService, DateSuggestionResult } from '../../services/farmer-chatbot.service';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

type LatLng = { lat: number; lng: number };
type PlaceSuggestion = { lat: string; lon: string; display_name: string };

@Component({
  selector: 'app-delivery-create',
  standalone: false,
  templateUrl: './delivery-create.component.html',
  styleUrls: ['./delivery-create.component.css']
})
export class DeliveryCreateComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer?: ElementRef;

  selectMode: 'start' | 'end' | null = 'start';

  startPoint: LatLng = { lat: 36.8065, lng: 10.1815 };
  endPoint: LatLng = { lat: 36.735, lng: 10.195 };

  productType = 'Tomates';
  weightKg = 100;
  details = '';
  autoGrouping = false;
  departureDate = this.todayDateTime();

  startSearchText = '';
  endSearchText = '';
  startLabel = 'Departure point';
  endLabel = 'Destination point';
  searchingStart = false;
  searchingEnd = false;
  searchError: string | null = null;
  startSuggestions: PlaceSuggestion[] = [];
  endSuggestions: PlaceSuggestion[] = [];

  private startSuggestTimer: number | null = null;
  private endSuggestTimer: number | null = null;
  private routeRequestSeq = 0;
  private pricingRequestSeq = 0;

  estimatedDistanceKm = 0;
  estimatedDurationHours = 0;
  estimatedPrice = 0;
  basePrice = 0;
  weatherExtra = 0;
  estimatedDistanceCharge = 0;
  estimatedWeightCharge = 0;
  weatherCondition = 'clear';
  weatherSurchargePercent = 0;

  reference = '';
  submitted = false;
  isSubmitting = false;
  submitError: string | null = null;
  createdDeliveryId = '';
  isPreferredTransporterFlow = false;
  knownTransporters: FarmerKnownTransporter[] = [];
  selectedTransporteurId: number | null = null;
  loadingTransporters = false;
  preferredTransporterError: string | null = null;

  checkingAi = false;
  aiSuggestion: DateSuggestionResult | null = null;
  aiError: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private mapService: DeliveryMapService,
    private requestService: DeliveryRequestService,
    private farmerChatbotService: FarmerChatbotService
  ) {}

  ngOnInit(): void {
    const role = getDeliveryUserRole();
    const isTransporter = role === 'transporteur' || role === 'transporter' || role.includes('transport');
    if (isTransporter) {
      this.router.navigate(['/delivery']);
      return;
    }

    this.isPreferredTransporterFlow = this.route.snapshot.routeConfig?.path === 'create-with-transporter';
    if (this.isPreferredTransporterFlow) {
      this.loadKnownTransporters();
    }

    this.recomputeEstimation();
  }

  private loadKnownTransporters(): void {
    this.loadingTransporters = true;
    this.preferredTransporterError = null;
    this.requestService.getPreferredTransportersForCurrentFarmer().subscribe((items) => {
      this.knownTransporters = items;
      this.loadingTransporters = false;
      if (!items.length) {
        this.preferredTransporterError = 'No transporter available. You must first complete at least one delivery with a transporter.';
      } else {
        this.selectedTransporteurId = items[0].transporteurId;
      }
    });
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.startSuggestTimer) window.clearTimeout(this.startSuggestTimer);
    if (this.endSuggestTimer) window.clearTimeout(this.endSuggestTimer);
    this.mapService.destroy();
  }

  private initializeMap(): void {
    if (!this.mapContainer) return;

    const centerLat = (this.startPoint.lat + this.endPoint.lat) / 2;
    const centerLng = (this.startPoint.lng + this.endPoint.lng) / 2;

    const map = this.mapService.initMap(this.mapContainer.nativeElement, centerLat, centerLng, 11);

    // Enable click-to-set-point on the Leaflet map
    map.on('click', (e: any) => {
      const latlng = e.latlng;
      if (!latlng) return;

      const point: LatLng = { lat: latlng.lat, lng: latlng.lng };
      if (this.selectMode === 'start') {
        this.startPoint = point;
        this.startLabel = 'Departure set on the map';
        // Smooth UX: after picking departure, switch to destination.
        this.selectMode = 'end';
      } else if (this.selectMode === 'end') {
        this.endPoint = point;
        this.endLabel = 'Destination set on the map';
      }

      this.renderPoints();
      this.recomputeEstimation();
    });

    this.renderPoints();
  }

  private renderPoints(): void {
    this.mapService.clear();

    const startMarker = this.mapService.addMarker(
      this.startPoint.lat,
      this.startPoint.lng,
      `<strong>${this.startLabel}</strong>`,
      {
        title: 'Departure',
        draggable: true,
        icon: this.mapService.getPointIcon('start')
      }
    );
    const endMarker = this.mapService.addMarker(
      this.endPoint.lat,
      this.endPoint.lng,
      `<strong>${this.endLabel}</strong>`,
      {
        title: 'Destination',
        draggable: true,
        icon: this.mapService.getPointIcon('end')
      }
    );

    startMarker.on('dragend', () => {
      const p = startMarker.getLatLng();
      this.startPoint = { lat: p.lat, lng: p.lng };
      this.startLabel = 'Departure moved';
      this.recomputeEstimation();
      this.renderPoints();
    });

    endMarker.on('dragend', () => {
      const p = endMarker.getLatLng();
      this.endPoint = { lat: p.lat, lng: p.lng };
      this.endLabel = 'Destination moved';
      this.recomputeEstimation();
      this.renderPoints();
    });

    const routePoints = [this.startPoint, this.endPoint];
    const requestSeq = ++this.routeRequestSeq;

    // Use road guidance first; service falls back only when needed.
    this.mapService.drawRouteOSRM(routePoints, '#00ACC1', 5).then(() => {
      this.mapService.fitBounds(routePoints, 80);
    });

    this.mapService.getRouteGuidance(routePoints).then((guidance) => {
      if (requestSeq !== this.routeRequestSeq || !guidance) {
        return;
      }

      this.estimatedDistanceKm = Math.max(0, Number(guidance.distanceKm || 0));
      this.estimatedDurationHours = Math.max(0.1, Math.round((Number(guidance.durationMinutes || 0) / 60) * 10) / 10);
      this.updateEstimatedPrice();
    });
  }

  setMode(mode: 'start' | 'end'): void {
    this.selectMode = mode;
  }

  async searchStart(): Promise<void> {
    this.startSuggestions = [];
    await this.searchLocation('start');
  }

  async searchEnd(): Promise<void> {
    this.endSuggestions = [];
    await this.searchLocation('end');
  }

  onSearchInput(mode: 'start' | 'end'): void {
    const query = (mode === 'start' ? this.startSearchText : this.endSearchText).trim();
    if (mode === 'start') {
      if (this.startSuggestTimer) window.clearTimeout(this.startSuggestTimer);
      if (!query) {
        this.startSuggestions = [];
        return;
      }
      this.startSuggestTimer = window.setTimeout(() => this.fetchSuggestions('start', query), 300);
      return;
    }

    if (this.endSuggestTimer) window.clearTimeout(this.endSuggestTimer);
    if (!query) {
      this.endSuggestions = [];
      return;
    }
    this.endSuggestTimer = window.setTimeout(() => this.fetchSuggestions('end', query), 300);
  }

  async pickSuggestion(mode: 'start' | 'end', suggestion: PlaceSuggestion): Promise<void> {
    const point: LatLng = { lat: Number(suggestion.lat), lng: Number(suggestion.lon) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;

    if (mode === 'start') {
      this.startPoint = point;
      this.startLabel = suggestion.display_name;
      this.startSearchText = suggestion.display_name;
      this.startSuggestions = [];
    } else {
      this.endPoint = point;
      this.endLabel = suggestion.display_name;
      this.endSearchText = suggestion.display_name;
      this.endSuggestions = [];
    }

    this.searchError = null;
    this.renderPoints();
    this.recomputeEstimation();
    this.mapService.getMap()?.flyTo([point.lat, point.lng], 12, { animate: true });
  }

  // Keep the old onMapClick for backwards compatibility but primary click is handled by Leaflet
  onMapClick(event: MouseEvent): void {
    // Now handled by Leaflet map click event in initializeMap
  }

  private async searchLocation(mode: 'start' | 'end'): Promise<void> {
    const query = (mode === 'start' ? this.startSearchText : this.endSearchText).trim();
    if (!query) {
      this.searchError = 'Please enter a location to search.';
      return;
    }

    this.searchError = null;
    if (mode === 'start') this.searchingStart = true;
    else this.searchingEnd = true;

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'fr' }
      });

      if (!response.ok) {
        throw new Error('Geocoding service unavailable.');
      }

      const results = (await response.json()) as PlaceSuggestion[];
      if (!results.length) {
        this.searchError = `No result found for "${query}".`;
        return;
      }

      const best = results[0];
      const point: LatLng = { lat: Number(best.lat), lng: Number(best.lon) };
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
        this.searchError = 'Invalid coordinates received from the search.';
        return;
      }

      if (mode === 'start') {
        this.startPoint = point;
        this.startLabel = best.display_name;
      } else {
        this.endPoint = point;
        this.endLabel = best.display_name;
      }

      this.renderPoints();
      this.recomputeEstimation();
      this.mapService.getMap()?.flyTo([point.lat, point.lng], 12, { animate: true });
    } catch (error) {
      console.error('Location search failed', error);
      this.searchError = 'Search failed. Please try again in a moment.';
    } finally {
      if (mode === 'start') this.searchingStart = false;
      else this.searchingEnd = false;
    }
  }

  private async fetchSuggestions(mode: 'start' | 'end', query: string): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'fr' }
      });
      if (!response.ok) throw new Error('Suggestion request failed');
      const suggestions = (await response.json()) as PlaceSuggestion[];
      if (mode === 'start') this.startSuggestions = suggestions;
      else this.endSuggestions = suggestions;
    } catch {
      if (mode === 'start') this.startSuggestions = [];
      else this.endSuggestions = [];
    }
  }

  private haversineKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(la1) * Math.cos(la2);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }

  recomputeEstimation(): void {
    // Fallback distance for UI until backend road guidance updates it.
    this.estimatedDistanceKm = Math.max(0, this.haversineKm(this.startPoint, this.endPoint));

    const speedKmH = 55;
    const bufferFactor = 1.25;
    this.estimatedDurationHours = Math.round((this.estimatedDistanceKm / speedKmH) * bufferFactor * 10) / 10;
    this.updateEstimatedPrice();
  }

  onWeightInput(): void {
    this.updateEstimatedPrice();
  }

  private updateEstimatedPrice(): void {
    const requestSeq = ++this.pricingRequestSeq;
    this.requestService.estimateDeliveryPrice({
      pickupLat: this.startPoint.lat,
      pickupLng: this.startPoint.lng,
      dropoffLat: this.endPoint.lat,
      dropoffLng: this.endPoint.lng,
      weightKg: this.weightKg,
      autoGrouping: this.autoGrouping,
      distanceKm: this.estimatedDistanceKm,
      durationHours: this.estimatedDurationHours
    }).subscribe((estimate) => {
      if (requestSeq !== this.pricingRequestSeq) {
        return;
      }

      if (!estimate) {
        this.weatherCondition = 'unknown';
        this.weatherSurchargePercent = 0;
        this.basePrice = 0;
        this.weatherExtra = 0;
        return;
      }

      this.estimatedDistanceKm = Math.max(0, Number(estimate.distanceKm || this.estimatedDistanceKm));
      this.estimatedDurationHours = Math.max(0.1, Number(estimate.durationHours || this.estimatedDurationHours));
      this.estimatedPrice = Math.max(0, Number(estimate.estimatedPrice || 0));
      this.weatherCondition = String(estimate.weatherCondition || 'clear');
      this.weatherSurchargePercent = Math.max(0, Number(estimate.weatherSurchargePercent || 0));
      const surchargeRatio = this.weatherSurchargePercent / 100;
      this.basePrice = surchargeRatio > 0 ? this.estimatedPrice / (1 + surchargeRatio) : this.estimatedPrice;
      this.weatherExtra = Math.max(0, this.estimatedPrice - this.basePrice);
      this.estimatedWeightCharge = 0;
      this.estimatedDistanceCharge = 0;
    });
  }


  private refreshMapSize(): void {
    const map = this.mapService.getMap?.();
    if (!map) return;
    map.invalidateSize();
    window.setTimeout(() => map.invalidateSize(), 120);
    window.setTimeout(() => map.invalidateSize(), 360);
  }

  checkWithAi(): void {
    if (this.checkingAi) return;
    this.aiError = null;
    this.aiSuggestion = null;

    if (!this.departureDate) {
      this.aiError = 'Please choose a preferred date first.';
      return;
    }
    if (!Number.isFinite(this.startPoint.lat) || !Number.isFinite(this.startPoint.lng)) {
      this.aiError = 'Please set the departure point on the map.';
      return;
    }
    if (!this.estimatedPrice || this.estimatedPrice <= 0) {
      this.aiError = 'The estimated price has not been calculated yet. Please wait.';
      return;
    }

    this.checkingAi = true;
    this.farmerChatbotService
      .suggestBestDate({
        pickupLat: this.startPoint.lat,
        pickupLng: this.startPoint.lng,
        preferredDate: this.departureDate,
        currentEstimatedPrice: this.estimatedPrice
      })
      .subscribe({
        next: (result) => {
          this.aiSuggestion = result;
          this.checkingAi = false;
          this.refreshMapSize();
        },
        error: (err: Error) => {
          this.aiError = err?.message || 'AI analysis unavailable at the moment.';
          this.checkingAi = false;
          this.refreshMapSize();
        }
      });
  }

  acceptAiSuggestion(): void {
    if (!this.aiSuggestion) return;
    this.departureDate = this.aiSuggestion.suggestedDateTime;
    this.recomputeEstimation();
    setTimeout(() => {
      this.aiSuggestion = null;
      this.aiError = null;
      this.refreshMapSize();
      this.submit();
    }, 150);
  }

  dismissAiSuggestion(): void {
    this.aiSuggestion = null;
    this.aiError = null;
    this.refreshMapSize();
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.submitError = null;
    this.submitted = false;
    this.createdDeliveryId = '';
    this.reference = `DLV-${Date.now().toString(36).toUpperCase()}`;
    this.isSubmitting = true;

    const baseInput = {
      reference: this.reference,
      product: this.productType,
      weightKg: this.weightKg,
      details: this.details,
      departureDate: this.departureDate,
      pickupLabel: this.startLabel,
      dropoffLabel: this.endLabel,
      estimatedPrice: this.estimatedPrice,
      pickupLat: this.startPoint.lat,
      pickupLng: this.startPoint.lng,
      dropoffLat: this.endPoint.lat,
      dropoffLng: this.endPoint.lng,
      autoGrouping: this.autoGrouping
    };

    if (this.isPreferredTransporterFlow) {
      if (!this.selectedTransporteurId) {
        this.isSubmitting = false;
        this.submitError = 'Please choose a transporter.';
        return;
      }

      this.requestService.createFromFarmerToTransporter(baseInput, this.selectedTransporteurId).subscribe((result) => {
        this.isSubmitting = false;
        const created = result.delivery;
        if (!created) {
          this.submitError = result.errorMessage || 'The transporter is not available on this slot. Please change the date and try again.';
          return;
        }

        this.reference = created.reference;
        this.createdDeliveryId = created.id;
        this.submitted = true;
        this.router.navigate(['/delivery/livraisons', this.createdDeliveryId], {
          state: { createdDelivery: true }
        });
      });
      return;
    }

    this.requestService.createFromFarmer(baseInput).subscribe((created) => {
      this.isSubmitting = false;

      if (!created) {
        this.submitError = 'The delivery was not saved on the backend. Please verify the Delivery service is running and try again.';
        return;
      }

      this.reference = created.reference;
      this.createdDeliveryId = created.id;
      this.submitted = true;
      this.router.navigate(['/delivery/livraisons', this.createdDeliveryId], {
        state: { createdDelivery: true }
      });
    });
  }

  goTracking(): void {
    if (this.createdDeliveryId) {
      this.router.navigate(['/delivery/livraisons', this.createdDeliveryId]);
      return;
    }

    this.router.navigate(['/delivery/livraisons']);
  }

  private todayDateTime(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}
