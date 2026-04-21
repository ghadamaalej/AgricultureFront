import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DeliveryMapService } from '../../services/delivery-map.service';
import { DeliveryRequestService, LivraisonApi } from '../../services/delivery-request.service';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

type Mode = 'create' | 'edit';
type PointMode = 'start' | 'end';
type LatLng = { lat: number; lng: number };

@Component({
  selector: 'app-delivery-admin-form',
  standalone: false,
  templateUrl: './delivery-admin-form.component.html',
  styleUrls: ['./delivery-admin-form.component.css']
})
export class DeliveryAdminFormComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer?: ElementRef;

  mode: Mode = 'create';
  id: string | null = null;
  role = getDeliveryUserRole();

  form: FormGroup;
  notification: string | null = null;

  selectMode: PointMode = 'start';
  startPoint: LatLng = { lat: 36.8065, lng: 10.1815 };
  endPoint: LatLng = { lat: 36.735, lng: 10.195 };
  startLabel = 'Current departure position';
  endLabel = 'Current destination position';

  private existingDelivery: LivraisonApi | null = null;
  private mapReady = false;
  private startLookupToken = 0;
  private endLookupToken = 0;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private requestService: DeliveryRequestService,
    private mapService: DeliveryMapService
  ) {
    this.form = this.fb.group({
      type: ['Locale'],
      status: ['En attente'],
      startAddress: [''],
      endAddress: [''],
      productType: ['Tomates'],
      weightKg: [100],
      priceTnd: [0],
      farmerId: [''],
      transporterId: [''],
      departureDate: [''],
      expectedDeliveryDate: [''],
      details: [''],
      autoGrouping: [false],
      groupingReference: ['']
    });
  }

  ngOnInit(): void {
    this.mode = (this.route.snapshot.data['mode'] as Mode) || 'create';
    this.id = this.route.snapshot.paramMap.get('id');

    if (this.mode === 'edit' && this.id) {
      this.requestService.getApiById(this.id).subscribe((delivery) => {
        if (!delivery) {
          this.notification = 'Unable to load the delivery to edit.';
          return;
        }

        this.existingDelivery = delivery;
        this.form.patchValue({
          type: delivery.type === 'LONGUE_DISTANCE' ? 'Longue distance' : 'Locale',
          status: this.fromBackendStatus(delivery.status),
          startAddress: delivery.adresseDepart || '',
          endAddress: delivery.adresseArrivee || '',
          productType: delivery.typeProduit || 'Tomates',
          weightKg: delivery.poids || 0,
          priceTnd: delivery.prix || 0,
          farmerId: delivery.agriculteurId || '',
          transporterId: delivery.transporteurId || '',
          departureDate: this.toDateInput(delivery.dateCreation),
          expectedDeliveryDate: this.toDateInput(delivery.dateLivraisonPrevue),
          details: delivery.detailsDemande || '',
          autoGrouping: Boolean(delivery.estRegroupable),
          groupingReference: delivery.groupReference || ''
        });

        this.applyDeliveryMapState(delivery);
      });
    }
  }

  ngAfterViewInit(): void {
    if (!this.isEdit()) {
      return;
    }

    window.setTimeout(() => this.initializeMap(), 150);
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  isEdit(): boolean {
    return this.mode === 'edit';
  }

  isFarmerEdit(): boolean {
    return this.isEdit() && (this.role === 'agriculteur' || this.role === 'farmer' || this.role.includes('agric'));
  }

  setMode(mode: PointMode): void {
    this.selectMode = mode;
  }

  submit(): void {
    const payload = this.buildPayload();
    const request$ = this.isEdit() && this.id
      ? this.requestService.updateApiDelivery(this.id, payload)
      : this.requestService.createApiDelivery(payload);

    request$.subscribe((saved) => {
      if (!saved?.id) {
        this.notification = this.isFarmerEdit()
          ? 'Edit not possible. A request accepted by a transporter can no longer be edited.'
          : 'The save failed.';
        return;
      }

      const action = this.isEdit() ? 'Update' : 'Creation';
      this.notification = `${action} completed successfully for ${saved.reference || 'the delivery'}.`;
      window.setTimeout(() => (this.notification = null), 3500);
      this.router.navigate(['/delivery/livraisons', saved.id]);
    });
  }

  goBack(): void {
    this.router.navigate(['/delivery/livraisons']);
  }

  private initializeMap(): void {
    if (!this.isEdit() || !this.mapContainer) {
      return;
    }

    const centerLat = (this.startPoint.lat + this.endPoint.lat) / 2;
    const centerLng = (this.startPoint.lng + this.endPoint.lng) / 2;
    const map = this.mapService.initMap(this.mapContainer.nativeElement, centerLat, centerLng, 10);

    map.on('click', (event: any) => {
      const latlng = event?.latlng;
      if (!latlng) {
        return;
      }

      this.updatePoint(this.selectMode, { lat: latlng.lat, lng: latlng.lng }, true);
    });

    this.mapReady = true;
    this.renderPoints();
  }

  private renderPoints(): void {
    if (!this.mapReady) {
      return;
    }

    this.mapService.clear();

    const startMarker = this.mapService.addMarker(
      this.startPoint.lat,
      this.startPoint.lng,
      `<strong>Departure</strong><br/>${this.startLabel}`,
      {
        title: 'Departure',
        draggable: true,
        zIndexOffset: 1000,
        icon: this.mapService.getPointIcon('start')
      }
    );

    const endMarker = this.mapService.addMarker(
      this.endPoint.lat,
      this.endPoint.lng,
      `<strong>Destination</strong><br/>${this.endLabel}`,
      {
        title: 'Destination point',
        draggable: true,
        zIndexOffset: 1000,
        icon: this.mapService.getPointIcon('end')
      }
    );

    startMarker.on('dragend', () => {
      const point = startMarker.getLatLng();
      this.updatePoint('start', { lat: point.lat, lng: point.lng });
    });

    endMarker.on('dragend', () => {
      const point = endMarker.getLatLng();
      this.updatePoint('end', { lat: point.lat, lng: point.lng });
    });

    this.mapService.drawRouteOSRM([this.startPoint, this.endPoint], '#00ACC1', 5).then(() => {
      this.mapService.fitBounds([this.startPoint, this.endPoint], 80);
    });
  }

  private updatePoint(mode: PointMode, point: LatLng, moveToNext: boolean = false): void {
    const fallback = this.formatFallbackLabel(mode === 'start' ? 'Departure updated' : 'Destination updated', point);

    if (mode === 'start') {
      this.startPoint = point;
      this.startLabel = fallback;
      if (moveToNext) {
        this.selectMode = 'end';
      }
    } else {
      this.endPoint = point;
      this.endLabel = fallback;
    }

    this.renderPoints();
    void this.reverseGeocode(mode, point, fallback);
  }

  private applyDeliveryMapState(delivery: LivraisonApi): void {
    this.startPoint = {
      lat: this.safeCoordinate(delivery.latDepart, this.startPoint.lat),
      lng: this.safeCoordinate(delivery.lngDepart, this.startPoint.lng)
    };
    this.endPoint = {
      lat: this.safeCoordinate(delivery.latArrivee, this.endPoint.lat),
      lng: this.safeCoordinate(delivery.lngArrivee, this.endPoint.lng)
    };
    this.startLabel = delivery.adresseDepart || this.formatFallbackLabel('Current departure', this.startPoint);
    this.endLabel = delivery.adresseArrivee || this.formatFallbackLabel('Current destination', this.endPoint);

    if (this.mapReady) {
      this.mapService.getMap()?.setView(
        [(this.startPoint.lat + this.endPoint.lat) / 2, (this.startPoint.lng + this.endPoint.lng) / 2],
        10
      );
      this.renderPoints();
    }
  }

  private async reverseGeocode(mode: PointMode, point: LatLng, fallback: string): Promise<void> {
    const token = mode === 'start' ? ++this.startLookupToken : ++this.endLookupToken;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}`,
        { headers: { 'Accept-Language': 'fr' } }
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }

      const data = (await response.json()) as { display_name?: string };
      const label = data.display_name || fallback;

      if (mode === 'start' && token === this.startLookupToken) {
        this.startLabel = label;
      }
      if (mode === 'end' && token === this.endLookupToken) {
        this.endLabel = label;
      }
    } catch {
      if (mode === 'start' && token === this.startLookupToken) {
        this.startLabel = fallback;
      }
      if (mode === 'end' && token === this.endLookupToken) {
        this.endLabel = fallback;
      }
    }

    this.renderPoints();
  }

  private buildPayload(): Partial<LivraisonApi> {
    const raw = this.form.getRawValue();
    const fallbackReference = this.existingDelivery?.reference || `LIV-${Date.now().toString(36).toUpperCase()}`;
    const farmerEdit = this.isFarmerEdit();
    const editMode = this.isEdit();

    return {
      reference: fallbackReference,
      type: editMode
        ? (this.existingDelivery?.type || this.toBackendType(raw.type))
        : this.toBackendType(raw.type),
      status: farmerEdit
        ? this.existingDelivery?.status
        : (editMode ? (this.toBackendStatus(raw.status) || this.existingDelivery?.status) : this.toBackendStatus(raw.status)),
      agriculteurId: farmerEdit
        ? (this.existingDelivery?.agriculteurId || this.requestService.getCurrentUserId())
        : (Number(raw.farmerId) || this.existingDelivery?.agriculteurId || 0),
      transporteurId: farmerEdit
        ? (this.existingDelivery?.transporteurId || 0)
        : (Number(raw.transporterId) || this.existingDelivery?.transporteurId || 0),
      dateCreation: this.toDateTime(raw.departureDate) || this.existingDelivery?.dateCreation,
      dateLivraisonPrevue: editMode
        ? this.existingDelivery?.dateLivraisonPrevue
        : this.toDateTime(raw.expectedDeliveryDate),
      adresseDepart: editMode ? this.startLabel : (raw.startAddress || ''),
      adresseArrivee: editMode ? this.endLabel : (raw.endAddress || ''),
      latDepart: editMode ? this.startPoint.lat : (this.existingDelivery?.latDepart || 0),
      lngDepart: editMode ? this.startPoint.lng : (this.existingDelivery?.lngDepart || 0),
      latArrivee: editMode ? this.endPoint.lat : (this.existingDelivery?.latArrivee || 0),
      lngArrivee: editMode ? this.endPoint.lng : (this.existingDelivery?.lngArrivee || 0),
      poids: Number(raw.weightKg) || 0,
      volume: this.existingDelivery?.volume || 0,
      typeProduit: raw.productType || 'Produit',
      detailsDemande: raw.details || '',
      estRegroupable: Boolean(raw.autoGrouping),
      prix: Number(raw.priceTnd) || 0,
      groupReference: editMode ? (this.existingDelivery?.groupReference || '') : (raw.groupingReference || '')
    };
  }

  private toBackendType(type: string | undefined): string {
    return type === 'Longue distance' ? 'LONGUE_DISTANCE' : 'LOCALE';
  }

  private toBackendStatus(status: string): string {
    switch (status) {
      case 'Acceptée':
        return 'ACCEPTEE';
      case 'En cours':
        return 'EN_COURS';
      case 'Livrée':
        return 'LIVREE';
      case 'Refusée':
        return 'ANNULEE';
      case 'En attente':
      default:
        return 'EN_ATTENTE';
    }
  }

  private fromBackendStatus(status?: string): string {
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

  private toDateInput(value?: string): string {
    return value ? value.slice(0, 10) : '';
  }

  private toDateTime(value?: string): string | undefined {
    return value ? `${value}T00:00:00` : undefined;
  }

  private safeCoordinate(value: number | undefined, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private formatFallbackLabel(prefix: string, point: LatLng): string {
    return `${prefix} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`;
  }
}
