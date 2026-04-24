import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Events } from '../../models/events';
import { EventListItem } from '../../models/event-list.model';
import { EventNearby } from 'src/app/models/event-nearby.model';


export interface DelayEventRequest {
  reason:                string;
  newDateDebut:          string;   
  newDateFin:            string;
  autorisationMunicipale?: string;
}

@Injectable({
  providedIn: 'root'
})

export class EventService {
  
 private apiUrl = 'http://localhost:8089/evenement/api/event';

  constructor(private http: HttpClient) {}

  getAllEvents(): Observable<EventListItem[]> {
  return this.http.get<EventListItem[]>(`${this.apiUrl}/getAllEvents`);
}

  getEventById(id: number): Observable<Events> {
  return this.http.get<Events>(`${this.apiUrl}/getEvent/${id}`);
  }

  getEventsByOrganisateur(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/GetOrganisateurEvents/${id}`);
  }
 
  addEvent(event: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/addEvent`, event);
  }
 
  updateEvent(event: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/updateEvent`, event);
  }
 
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/deleteEvent/${id}`);
  }
  cancelEvent(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cancelEvent/${id}`, {});
  }
 
  delayEvent(id: number, payload: DelayEventRequest): Observable<Events> {
    return this.http.put<Events>(`${this.apiUrl}/delayEvent/${id}`, payload);
  }

 getAllEventsMap(lat: number, lon: number): Observable<EventNearby[]> {
  const params = new HttpParams()
    .set('lat', lat)
    .set('lon', lon);

  return this.http.get<EventNearby[]>(
    `${this.apiUrl}/map/all`,
    { params }
  );
}

getRoute(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const params = new HttpParams()
    .set('fromLat', fromLat)
    .set('fromLon', fromLon)
    .set('toLat', toLat)
    .set('toLon', toLon);

  return this.http.get<any>(`${this.apiUrl}/route`, { params });
}

optimizeRoute(body: any): Observable<any> {
  return this.http.post(`${this.apiUrl}/optimize-route`, body);
}

snapRoute(coords: number[][]): Observable<any> {
  return this.http.post(`${this.apiUrl}/snap`, coords);
}


  getUserPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        resolve, reject,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      )
    );
  }

  getDocumentUrl(fileName: string): string {
  return `assets/images/${encodeURIComponent(fileName)}`;
}


}