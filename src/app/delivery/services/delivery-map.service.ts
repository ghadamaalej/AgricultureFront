import { Injectable } from '@angular/core';
import * as L from 'leaflet';

export type RouteInstruction = {
  text: string;
  distanceKm: number;
  durationMinutes: number;
};

export type RouteGuidance = {
  polyline: { lat: number; lng: number }[];
  distanceKm: number;
  durationMinutes: number;
  etaMinutes: number;
  instructions: RouteInstruction[];
};

@Injectable({
  providedIn: 'root'
})
export class DeliveryMapService {
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private polyline: L.Polyline | null = null;
  private routeShadow: L.Polyline | null = null;
  private extraLayers: L.Layer[] = [];
  private iconConfigured = false;
  private readonly markerShadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
  private readonly guidanceCacheTtlMs = 12000;
  private readonly routingFailureCooldownMs = 30000;
  private routingLastWarnAt = 0;
  private readonly routingApiUrl = '/livraison/api/livraisons/routing/best-path';
  private guidanceCache = new Map<string, { at: number; guidance: RouteGuidance }>();
  private routeRenderSeq = 0;

  getPointIcon(type: 'start' | 'end'): L.Icon {
    const iconUrl =
      type === 'start'
        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
        : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png';

    return L.icon({
      iconUrl,
      shadowUrl: this.markerShadowUrl,
      iconRetinaUrl: iconUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }

  private ensureLeafletAssetsConfigured(): void {
    if (this.iconConfigured) return;

    // In Angular builds, Leaflet default icon URLs are often unresolved without explicit setup.
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });

    this.iconConfigured = true;
  }

  initMap(container: string | HTMLElement, lat: number = 36.78, lng: number = 10.19, zoom: number = 12): L.Map {
    this.ensureLeafletAssetsConfigured();

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(container, {
      zoomControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      preferCanvas: true
    }).setView([lat, lng], zoom);

    // Use CartoDB Voyager for a clean, modern look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
      minZoom: 2,
      subdomains: 'abcd'
    }).addTo(this.map);

    // Modern zoom control on the top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Fix sizing glitches when map is inside animated/flex containers.
    this.map.whenReady(() => {
      this.map?.invalidateSize();
      window.setTimeout(() => this.map?.invalidateSize(), 200);
    });

    return this.map;
  }

  addMarker(lat: number, lng: number, label: string = '', options?: L.MarkerOptions): L.Marker {
    if (!this.map) throw new Error('Map not initialized');

    const marker = L.marker([lat, lng], options).addTo(this.map);
    if (label) {
      marker.bindPopup(`<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:13px;">${label}</div>`, {
        closeButton: false,
        className: 'delivery-popup'
      });
    }
    this.markers.push(marker);
    return marker;
  }

  addCircleMarker(lat: number, lng: number, radius: number = 8, color: string = '#3388ff'): L.CircleMarker {
    if (!this.map) throw new Error('Map not initialized');

    const circleMarker = L.circleMarker([lat, lng], {
      radius,
      fillColor: color,
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(this.map);

    // Pulsing effect for vehicle
    const pulse = L.circleMarker([lat, lng], {
      radius: radius + 8,
      fillColor: color,
      color: color,
      weight: 2,
      opacity: 0.3,
      fillOpacity: 0.15
    }).addTo(this.map);

    this.extraLayers.push(pulse);
    this.markers.push(circleMarker as any);
    return circleMarker;
  }

  /**
   * Draw route from backend guidance. If backend is unavailable, keep a simple fallback line.
   */
  async drawRouteOSRM(points: { lat: number; lng: number }[], color: string = '#4caf50', weight: number = 5): Promise<L.Polyline | null> {
    if (!this.map) throw new Error('Map not initialized');
    const renderSeq = ++this.routeRenderSeq;

    if (this.routeShadow) {
      this.map.removeLayer(this.routeShadow);
      this.routeShadow = null;
    }

    if (this.polyline) {
      this.map.removeLayer(this.polyline);
      this.polyline = null;
    }

    if (points.length < 2) return null;

    const guidance = await this.getRouteGuidance(points);
    if (renderSeq !== this.routeRenderSeq) {
      return null;
    }

    if (guidance && guidance.polyline.length > 1) {
      const latLngs = guidance.polyline.map((point) => [point.lat, point.lng] as [number, number]);

      // Shadow line for depth
      if (!this.map) return null;
      const shadow = L.polyline(latLngs, {
        color: '#000',
        weight: weight + 4,
        opacity: 0.08,
        smoothFactor: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      if (renderSeq !== this.routeRenderSeq) {
        this.map.removeLayer(shadow);
        return null;
      }
      this.routeShadow = shadow;

      if (!this.map) return null;
      this.polyline = L.polyline(latLngs, {
        color,
        weight,
        opacity: 0.85,
        smoothFactor: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);
      if (renderSeq !== this.routeRenderSeq) {
        this.map.removeLayer(this.polyline);
        this.polyline = null;
        return null;
      }

      return this.polyline;
    }

    // No frontend fallback line: route must come from backend only.
    return null;
  }

  async drawChainedRouteOSRM(points: { lat: number; lng: number }[], color: string = '#4caf50', weight: number = 5): Promise<L.Polyline | null> {
    if (!this.map) throw new Error('Map not initialized');
    const renderSeq = ++this.routeRenderSeq;

    if (this.routeShadow) {
      this.map.removeLayer(this.routeShadow);
      this.routeShadow = null;
    }
    if (this.polyline) {
      this.map.removeLayer(this.polyline);
      this.polyline = null;
    }

    if (points.length < 2) return null;

    const mergedPolyline: { lat: number; lng: number }[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const leg = [points[i], points[i + 1]];
      const guidance = await this.getRouteGuidance(leg);
      if (renderSeq !== this.routeRenderSeq) {
        return null;
      }
      const segment = guidance && guidance.polyline.length > 1 ? guidance.polyline : leg;
      if (mergedPolyline.length > 0) {
        segment.slice(1).forEach((p) => mergedPolyline.push(p));
      } else {
        segment.forEach((p) => mergedPolyline.push(p));
      }
    }

    if (mergedPolyline.length < 2 || !this.map) return null;

    const latLngs = mergedPolyline.map((p) => [p.lat, p.lng] as [number, number]);

    const shadow = L.polyline(latLngs, {
      color: '#000',
      weight: weight + 4,
      opacity: 0.08,
      smoothFactor: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);
    if (renderSeq !== this.routeRenderSeq) {
      this.map.removeLayer(shadow);
      return null;
    }
    this.routeShadow = shadow;

    this.polyline = L.polyline(latLngs, {
      color,
      weight,
      opacity: 0.85,
      smoothFactor: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);
    if (renderSeq !== this.routeRenderSeq) {
      this.map.removeLayer(this.polyline);
      this.polyline = null;
      return null;
    }

    return this.polyline;
  }

  async getRouteGuidance(points: { lat: number; lng: number }[]): Promise<RouteGuidance | null> {
    if (points.length < 2) {
      return null;
    }

    const now = Date.now();
    const cacheKey = this.toGuidanceCacheKey(points);
    const cached = this.guidanceCache.get(cacheKey);
    if (cached && now - cached.at < this.guidanceCacheTtlMs) {
      return cached.guidance;
    }

    try {
      const guidance = await this.fetchGuidanceFromBackend(points);
      if (guidance) {
        this.guidanceCache.set(cacheKey, { at: now, guidance });
        return guidance;
      }
    } catch {
      // Handled below.
    }

    if (now - this.routingLastWarnAt > this.routingFailureCooldownMs) {
      console.warn('Backend routing unavailable, route guidance skipped.');
      this.routingLastWarnAt = now;
    }

    return null;
  }

  private async fetchGuidanceFromBackend(points: { lat: number; lng: number }[]): Promise<RouteGuidance | null> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);

    try {
      const payload = {
        points: points.map((point, index) => ({
          lat: point.lat,
          lng: point.lng,
          kind: index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'stop'
        }))
      };

      const res = await fetch(this.routingApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Routing HTTP ${res.status}`);
      }

      const contentType = String(res.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        throw new Error('Routing non-JSON response');
      }

      const data = await res.json();
      const polyline = (Array.isArray(data?.polyline) ? data.polyline : [])
        .map((coord: any) => ({
          lat: Number(coord?.lat),
          lng: Number(coord?.lng)
        }))
        .filter((coord: { lat: number; lng: number }) => Number.isFinite(coord.lat) && Number.isFinite(coord.lng));

      if (polyline.length < 2) {
        return null;
      }

      const instructions: RouteInstruction[] = (Array.isArray(data?.instructions) ? data.instructions : [])
        .map((step: any) => ({
          text: String(step?.text || '').trim(),
          distanceKm: Number((Number(step?.distanceKm || 0)).toFixed(2)),
          durationMinutes: Math.max(1, Math.round(Number(step?.durationMinutes || 0)))
        }))
        .filter((step: RouteInstruction) => Boolean(step.text));

      const durationMinutes = Math.max(1, Math.round(Number(data?.durationMinutes || 0)));
      return {
        polyline,
        distanceKm: Number((Number(data?.distanceKm || 0)).toFixed(2)),
        durationMinutes,
        etaMinutes: Math.max(1, Math.round(Number(data?.etaMinutes || durationMinutes))),
        instructions
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private toGuidanceCacheKey(points: { lat: number; lng: number }[]): string {
    return points
      .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
      .join(';');
  }


  drawRoute(points: { lat: number; lng: number }[], color: string = '#FF6B6B', weight: number = 4): L.Polyline | null {
    if (!this.map) return null;

    if (this.polyline) {
      this.map.removeLayer(this.polyline);
    }

    const latLngs = points.map(p => [p.lat, p.lng] as [number, number]);

    // Shadow line
    const shadow = L.polyline(latLngs, {
      color: '#000',
      weight: weight + 4,
      opacity: 0.08,
      smoothFactor: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);
    this.extraLayers.push(shadow);

    this.polyline = L.polyline(latLngs, {
      color,
      weight,
      opacity: 0.85,
      smoothFactor: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    return this.polyline;
  }

  fitBounds(points: { lat: number; lng: number }[], padding: number = 60): void {
    if (!this.map || points.length === 0) return;

    const latLngs = points.map(p => [p.lat, p.lng] as [number, number]);
    const bounds = L.latLngBounds(latLngs);
    this.map.fitBounds(bounds, { padding: [padding, padding], animate: true, duration: 0.5 });
  }

  clearMarkers(): void {
    this.markers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.markers = [];
  }

  clearRoute(): void {
    if (this.polyline && this.map) {
      this.map.removeLayer(this.polyline);
      this.polyline = null;
    }
    if (this.routeShadow && this.map) {
      this.map.removeLayer(this.routeShadow);
      this.routeShadow = null;
    }
  }

  clearExtras(): void {
    this.extraLayers.forEach(l => {
      if (this.map) this.map.removeLayer(l);
    });
    this.extraLayers = [];
  }

  clear(): void {
    this.clearMarkers();
    this.clearRoute();
    this.clearExtras();
  }

  getMap(): L.Map | null {
    return this.map;
  }

  destroy(): void {
    if (this.map) {
      this.clear();
      this.map.remove();
      this.map = null;
    }
  }
}
