import {AfterViewInit,ChangeDetectorRef,Component,ElementRef,OnDestroy,OnInit,ViewChild} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { EventNearby, formatDuration, TYPE_CONFIG } from 'src/app/models/event-nearby.model';
import { EventService } from 'src/app/services/event/event.service';
import { point } from 'leaflet';

type MarkerClusterGroup = any;

@Component({
  selector: 'app-event-map',
  standalone: false,
  templateUrl: './event-map.component.html',
  styleUrls: ['./event-map.component.css']
})
export class EventMapComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('mapHost', { static: false }) mapHost!: ElementRef<HTMLDivElement>;

  page: number = 1;
  pageSize: number = 3;

  private routeLayer?: L.Layer;
  private map!: L.Map;
  private markerGroup!: MarkerClusterGroup;
  selectedEvents: EventNearby[] = [];
  private markerMap = new Map<number, L.Marker>();

  private destroy$ = new Subject<void>();
  private radiusChange$ = new Subject<void>();
  private resizeObserver?: ResizeObserver;

  events: EventNearby[] = [];
  selected: EventNearby | null = null;
  loading = false;
  locError = '';
  userLat = 0;
  userLon = 0;

  private currentRouteCoords: L.LatLng[] = [];
  private routeIndex = 0;
  private animationFrame?: number;
  private lastPosition?: L.LatLng;
  eta = '';
  distanceLeft = 0;

  filterType = '';
  travelMode: 'walk' | 'bike' | 'car' = 'car';
  typeOptions = ['FAIR', 'MARKET', 'WORKSHOP', 'DEMONSTRATION'];

  private focusId: number | null = null;
  mapReady = false;

  readonly typeConfig = TYPE_CONFIG;
  readonly formatDur = formatDuration;

  private navMarker?: L.Marker;
  private watchId?: number;
  isNavigating = false;

  hasRoute: boolean = false;

  constructor(
  private svc: EventService,
  private route: ActivatedRoute,
  private router: Router,
  private cdr: ChangeDetectorRef
) { }

get paginatedEvents(): EventNearby[] {
  const start = (this.page - 1) * this.pageSize;
  return this.events.slice(start, start + this.pageSize);
}

get totalPages(): number {
  return Math.ceil(this.events.length / this.pageSize);
}

openEventDetails(ev: EventNearby): void {
  this.router.navigate(['/events/detailsEvent', ev.id]);
}


private drawRoute(routeGeoJson: any): void {

  if (this.routeLayer) {
    this.routeLayer.remove();
  }

  this.routeLayer = L.geoJSON(routeGeoJson, {
    style: {
      color: '#007bff',
      weight: 5
    }
  }).addTo(this.map);

  this.hasRoute = true;

  this.currentRouteCoords = routeGeoJson.coordinates.map(
    (c: any) => L.latLng(c[1], c[0])
  );

  this.routeIndex = 0;
}

private findClosestIndex(current: L.LatLng): number {
  let minDist = Infinity;
  let index = 0;

  this.currentRouteCoords.forEach((p, i) => {
    const d = current.distanceTo(p);
    if (d < minDist) {
      minDist = d;
      index = i;
    }
  });

  return index;
}

showRoute(ev: EventNearby) {
  if (!this.mapReady) return;

  this.svc.getRoute(this.userLat, this.userLon,ev.latitude,ev.longitude).subscribe({
    next: (data) => {

      const route = data?.routes?.[0]?.geometry;

      if (!route) return;

      this.drawRoute(route);

      this.map.fitBounds(L.geoJSON(route).getBounds(), {
        padding: [50, 50]
      });
    },
    error: (err) => console.error('Route error', err)
  });
}


  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.focusId = params['focusId'] ? +params['focusId'] : null;
    });

    this.radiusChange$.pipe(
      debounceTime(400),
      takeUntil(this.destroy$)
    ).subscribe(() => this.loadEvents());

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.map && this.mapReady) {
        requestAnimationFrame(() => this.map.invalidateSize(true));
      }
    });
  }

 ngAfterViewInit() {
  setTimeout(() => {
    this.initMap();

    this.observeMapResize(); 
    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);
  });
}

  private observeMapResize(): void {
    const host = this.mapHost?.nativeElement;
    if (!host) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.map && this.mapReady) {
        this.map.invalidateSize(true);
      }
    });

    this.resizeObserver.observe(host);
  }


  private initMap(): void {
    const mapContainer = this.mapHost?.nativeElement;
    if (!mapContainer) {
      console.error('agri-map container not found');
      return;
    }

    this.map = L.map(mapContainer, {
      center: [36.8065, 10.1815],
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
      inertia: false,
      fadeAnimation: false,
      zoomAnimation: true
    });

    const tileLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 20,
    minZoom: 2,
    crossOrigin: true
  }
);

    tileLayer.on('load', () => {
      console.log('Tiles loaded');
      this.map.invalidateSize(true);
    });

    tileLayer.on('tileerror', (err) => {
      console.warn('Tile error:', err);
    });

    tileLayer.addTo(this.map);

    this.markerGroup = (L as any).markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    disableClusteringAtZoom: 16
     });

this.map.addLayer(this.markerGroup);
    this.mapReady = true;

    this.map.whenReady(() => {
      setTimeout(() => {
        this.map.invalidateSize(true);
        this.locateUser();
      }, 150);
    });
  }

  async locateUser(): Promise<void> {
    this.loading = true;
    this.locError = '';

    this.userLat = 36.8065;
    this.userLon = 10.1815;

    try {
      const pos = await Promise.race([
        this.svc.getUserPosition(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 8000)
        )
      ]);

      this.userLat = pos.coords.latitude;
      this.userLon = pos.coords.longitude;
      this.locError = '';
    } catch (err) {
      console.warn('Geolocation failed, using default Tunis location:', err);
      this.locError = 'Position par défaut (Tunis)';
    }

    if (this.map && this.mapReady) {
      this.map.setView([this.userLat, this.userLon], 11, { animate: false });
      this.drawUserLayer();

      setTimeout(() => {
        this.map.invalidateSize(true);
        this.loadEvents();
      }, 150);
    }

    this.loading = false;
    this.cdr.markForCheck();
  }

  private drawUserLayer(): void {
    if (!this.map || !this.mapReady) return;

    const icon = L.divIcon({
      html: `<div style="background:#E24B4A;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #E24B4A"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: ''
    });

    L.marker([this.userLat, this.userLon], { icon })
      .addTo(this.map)
      .bindTooltip('Votre position', { permanent: false, direction: 'top' });
  }

 loadEvents(): void {
  if (!this.mapReady) return;

  this.loading = true;

  this.svc.getAllEventsMap(this.userLat, this.userLon)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: evts => {

        this.events = evts; 
         this.page = 1;

        this.renderMarkers(this.events);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        console.error(err);
        this.loading = false;
      }
    });
}

  private renderMarkers(events: EventNearby[]) {
  if (!this.markerGroup) return;

  this.markerGroup.clearLayers();
  this.markerMap.clear();

  const bounds = L.latLngBounds([[this.userLat, this.userLon]]);

  events.forEach(ev => {
    const cfg = TYPE_CONFIG[ev.type] ?? {
      color: '#888',
      label: ev.type,
      letter: '?'
    };

    const marker = L.marker([ev.latitude, ev.longitude], {
      icon: this.makeIcon(cfg.color, cfg.letter)
    });

    const popup = this.buildPopup(ev, cfg);

    marker.bindPopup(popup);

   marker.on('popupopen', (e: any) => {
  const el = e.popup.getElement();
  if (!el) return;

  const followBtn = el.querySelector('.follow-btn') as HTMLElement | null;

if (followBtn) {
  followBtn.onclick = () => this.startNavigation();
}

  const detailsBtn = el.querySelector('.details-btn') as HTMLElement | null;

if (detailsBtn) {
  detailsBtn.onclick = () => {
    this.openEventDetails(ev);
  };
}

  const routeBtn = el.querySelector('.route-btn') as HTMLElement | null;
  const toggleBtn = el.querySelector('.toggle-btn') as HTMLElement | null;

  if (routeBtn) {
    routeBtn.onclick = () => this.showRoute(ev);
  }

  if (toggleBtn) {
    toggleBtn.onclick = () => {
      this.toggleEvent(ev);
      this.cdr.detectChanges(); 
    };
  }
});

    marker.on('click', () => {
      this.selected = ev;
      this.cdr.markForCheck();
    });

    this.markerGroup.addLayer(marker);
    this.markerMap.set(ev.id, marker);
    bounds.extend([ev.latitude, ev.longitude]);
  });

  if (events.length) {
    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }
  
}
startNavigation() {
  if (!this.routeLayer) return;

  this.isNavigating = true;

  this.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

     const current = L.latLng(lat, lng);

     this.routeIndex = this.findClosestIndex(current);

     const snapped = this.currentRouteCoords[this.routeIndex];
    this.animateTo(snapped);
     this.checkDeviationAndRecalculate(current);
     this.updateETA(current);

    },
    (err) => console.error(err),
    { enableHighAccuracy: true }
  );
}

private checkDeviationAndRecalculate(current: L.LatLng) {
  if (!this.currentRouteCoords.length) return;

  const nearest = this.currentRouteCoords[this.routeIndex];

  const dist = current.distanceTo(nearest);

  // si déviation > 50m → recalcul
  if (dist > 50) {
    console.log('Recalcul route...');

    const lastTarget = this.selected;

    if (lastTarget) {
      this.showRoute(lastTarget); 
    }
  }
}

private updateETA(current: L.LatLng) {

  if (!this.currentRouteCoords.length) return;

  let distance = 0;

  for (let i = this.routeIndex; i < this.currentRouteCoords.length - 1; i++) {
    distance += this.currentRouteCoords[i].distanceTo(this.currentRouteCoords[i + 1]);
  }

  this.distanceLeft = distance;

  const speed = 13.8;

  const timeSec = distance / speed;

  const min = Math.floor(timeSec / 60);

  this.eta = `${min} min`;

  this.cdr.detectChanges();
}


stopNavigation() {
  this.isNavigating = false;

  if (this.watchId) {
    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = undefined;
  }

  if (this.navMarker) {
    this.map.removeLayer(this.navMarker);
    this.navMarker = undefined;
  }
}

private animateTo(point: L.LatLng) {

  if (!this.lastPosition) {
    this.lastPosition = point;
  }

  const start = this.lastPosition;
  const end = point;

  const duration = 1000; 
  const startTime = performance.now();

  const animate = (time: number) => {
    const t = Math.min((time - startTime) / duration, 1);

    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;

    const pos = L.latLng(lat, lng);

    this.updateNavMarkerInstant(pos);

    if (t < 1) {
      this.animationFrame = requestAnimationFrame(animate);
    } else {
      this.lastPosition = end;
    }
  };

  cancelAnimationFrame(this.animationFrame!);
  this.animationFrame = requestAnimationFrame(animate);
}

private updateNavMarkerInstant(point: L.LatLng) {
  if (!this.navMarker) {
    this.navMarker = L.marker(point, {
  icon: L.divIcon({
    html: `<div style="font-size:40px; line-height:40px;">🚗</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })
}).addTo(this.map);
  } else {
    this.navMarker.setLatLng(point);
  }

  this.map.panTo(point, { animate: true });
}

  private makeIcon(color: string, letter: string): L.DivIcon {
    return L.divIcon({
      html: `<div style="
        background:${color};color:#fff;
        width:34px;height:34px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:14px;
        border:2px solid rgba(255,255,255,.85)">
        <span style="transform:rotate(45deg)">${letter}</span>
      </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -38],
      className: ''
    });
  }

  private buildPopup(ev: EventNearby, cfg: { color: string; label: string }): string {
    const isSelected = this.selectedEvents.some(e => e.id === ev.id);
    const fillColor = ev.fillPercent >= 90 ? '#E24B4A'
      : ev.fillPercent >= 70 ? '#EF9F27' : '#3B6D11';

    const date = new Date(ev.dateDebut).toLocaleDateString('fr-FR', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });

    return `
      <div style="font-family:sans-serif;min-width:230px;font-size:13px">
        <div style="background:${cfg.color};color:#fff;padding:8px 12px;margin:-12px -12px 10px;border-radius:4px 4px 0 0;font-size:11px">
          <b>${cfg.label}</b> ·${ev.distanceKm ? ev.distanceKm.toFixed(1) : '0'} km de vous
        </div>

        <b style="font-size:14px;display:block;margin-bottom:3px">${ev.titre}</b>
        <div style="color:#666;font-size:12px;margin-bottom:2px">${date}</div>
        <div style="color:#555;font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <i class="fa-solid fa-location-dot" style="color:#E24B4A"></i>
        <span>${ev.lieu}${ev.region ? ', ' + ev.region : ''}</span>
        </div>

        <div style="margin-bottom:8px">
          <div style="background:#eee;height:6px;border-radius:3px;overflow:hidden">
            <div style="background:${fillColor};width:${ev.fillPercent}%;height:100%;border-radius:3px"></div>
          </div>
          <div style="font-size:11px;color:#888;margin-top:2px">
            ${ev.inscrits} / ${ev.capaciteMax} inscrits (${ev.fillPercent}%)
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">

  <div style="background:#f8f9fa;border-radius:10px;padding:8px;text-align:center">
    <i class="fa-solid fa-person-walking" style="color:#555"></i>
    <div style="font-size:12px;font-weight:600;margin-top:4px">
      ${formatDuration(ev.walkMinutes)}
    </div>
    <div style="font-size:10px;color:#888">Walk</div>
  </div>

  <div style="background:#f8f9fa;border-radius:10px;padding:8px;text-align:center">
    <i class="fa-solid fa-bicycle" style="color:#555"></i>
    <div style="font-size:12px;font-weight:600;margin-top:4px">
      ${formatDuration(ev.bikeMinutes)}
    </div>
    <div style="font-size:10px;color:#888">Bike</div>
  </div>

  <div style="background:#f8f9fa;border-radius:10px;padding:8px;text-align:center">
    <i class="fa-solid fa-car" style="color:#555"></i>
    <div style="font-size:12px;font-weight:600;margin-top:4px">
      ${formatDuration(ev.carMinutes)}
    </div>
    <div style="font-size:10px;color:#888">Car</div>
  </div>

</div>

        ${
          ev.montant > 0
            ? `<div style="font-size:12px;color:#854F0B;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-coins" style="color:#f5a623"></i><span>${ev.montant.toFixed(2)} DT</span></div>`
            : `<div style="font-size:12px;color:#3B6D11;font-weight:500;margin-bottom:8px">✓ Entrée gratuite</div>`
        }

        <button class="details-btn" data-id="${ev.id}" style="width:100%;margin-top:8px;padding:8px;border:none;background:${cfg.color};color:white;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;">
           <i class="fa-solid fa-circle-info"></i>
           Event Details
        </button>
        <button class="route-btn" data-id="${ev.id}" style="width:100%;margin-top:8px;padding:8px;border:none;background:#31b600;color:white;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;"><i class="fa-solid fa-route">
        </i> Optimal route
        </button>
        ${this.hasRoute ? `<button class="follow-btn"style="width:100%;margin-top:8px;padding:8px;border:none;background:#007bff;color:white;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;"><i class="fa-solid fa-location-arrow"></i>
           Suivre ce chemin
        </button>
        ` : ``}

<button class="toggle-btn" data-id="${ev.id}" style="width:100%;margin-top:6px;padding:8px;border:none;background:${isSelected ? '#E24B4A' : '#444'};color:white;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;"><i class="fa-solid ${isSelected ? 'fa-xmark' : 'fa-plus'}"></i>${isSelected ? 'Retirer' : 'Ajouter'}</button>
      </div>`;
  }

  onTypeChange(): void {
    this.loadEvents();
  }

  onTravelModeChange(mode: 'walk' | 'bike' | 'car'): void {
    this.travelMode = mode;
    this.events = [...this.events].sort((a, b) => {
      const k = mode === 'walk' ? 'walkMinutes' : mode === 'bike' ? 'bikeMinutes' : 'carMinutes';
      return a[k] - b[k];
    });
  }

  selectEvent(ev: EventNearby): void {
    this.selected = ev;
    if (this.map && this.mapReady) {
      this.map.setView([ev.latitude, ev.longitude], 14, { animate: true });
      const marker = this.markerMap.get(ev.id);
      if (marker) marker.openPopup();
    }
    this.cdr.markForCheck();
  }

  getTravelTime(ev: EventNearby): string {
    const min = this.travelMode === 'walk'
      ? ev.walkMinutes
      : this.travelMode === 'bike'
        ? ev.bikeMinutes
        : ev.carMinutes;

    return formatDuration(min);
  }

  getTypeLabel(type: string): string {
    return TYPE_CONFIG[type]?.label ?? type;
  }

  getTypeColor(type: string): string {
    return TYPE_CONFIG[type]?.color ?? '#888';
  }

  goBack(): void {
    this.router.navigate(['/events/listEvents']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.map) {
      this.map.remove();
      this.map = null as any;
    }
  }
toggleEvent(ev: EventNearby) {
  const exists = this.selectedEvents.some(e => e.id === ev.id);

  if (exists) {
    this.selectedEvents = this.selectedEvents.filter(e => e.id !== ev.id);
  } else {
    this.selectedEvents = [...this.selectedEvents, ev];
  }

  if (this.selectedEvents.length < 2) {
  if (this.routeLayer) {
    this.routeLayer.remove();
    this.routeLayer = undefined;
  }
  this.hasRoute = false; 
}

  const marker = this.markerMap.get(ev.id);
  if (marker) {
    marker.setPopupContent(this.buildPopup(ev, TYPE_CONFIG[ev.type] ?? {
      color: '#888',
      label: ev.type,
      letter: '?'
    }));
  }

  if (this.selectedEvents.length >= 2) {
    this.hasRoute = true;
    this.buildOptimizedRoute(this.selectedEvents);
  } else {
    if (this.routeLayer) {
      this.hasRoute = false;
      this.routeLayer.remove();
      this.routeLayer = undefined;
    }
  }

  this.cdr.detectChanges();
}
optimizeRoute() {

  if (this.selectedEvents.length < 2) return;

  const body = {
    user: [this.userLat, this.userLon],
    events: this.selectedEvents.map(e => [e.latitude, e.longitude])
  };

  this.svc.optimizeRoute(body).subscribe((res: any) => {

    const order: number[] = res.order;

    // reorder events
    const sorted = order.map(i => this.selectedEvents[i]);

    this.selectedEvents = sorted;

    this.buildOptimizedRoute(sorted);
  });
}
drawOptimizedRoute(events: EventNearby[]) {

  const coords = [
    this.toLonLat(this.userLat, this.userLon),
    ...events.map(e => this.toLonLat(e.latitude, e.longitude))
  ];

  this.svc.snapRoute(coords).subscribe((res: any) => {
    const geo = res.matchings?.[0]?.geometry;
    if (geo) this.drawRoute(geo);
  });
}


buildOptimizedRoute(events: EventNearby[]) {

  if (!events.length) return;

  const body = {
    user: [this.userLat, this.userLon],
    events: events.map(e => [e.latitude, e.longitude])
  };

  this.svc.optimizeRoute(body).subscribe((res: any) => {

    console.log('OSRM response:', res);

    const route = res.trips?.[0];

    if (!route?.geometry) {
      console.error('No route found');
      return;
    }

    const geoJson = route.geometry;

    if (this.routeLayer) {
      this.routeLayer.remove();
    }

    this.routeLayer = L.geoJSON(geoJson, {
      style: {
        color: '#440df8',
        weight: 4,
        opacity: 0.9
      }
    }).addTo(this.map);

    this.hasRoute = true;

this.markerMap.forEach((marker, id) => {
  const ev = this.events.find(e => e.id === id);
  if (!ev) return;

  const cfg = TYPE_CONFIG[ev.type] ?? {
    color: '#888',
    label: ev.type,
    letter: '?'
  };

  marker.setPopupContent(this.buildPopup(ev, cfg));
});

    this.map.fitBounds(
      L.geoJSON(geoJson).getBounds(),
      { padding: [60, 60] }
    );
  });
}


private toLonLat(lat: number, lon: number): [number, number] {
  return [lon, lat];
}
}