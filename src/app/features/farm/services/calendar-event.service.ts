import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EvenementCalendrierApi, RappelApi } from '../models/calendar.model';

@Injectable({
  providedIn: 'root'
})
export class CalendarEventService {
  // Matches your Spring Boot app in application.properties (server.port=8091)
  private readonly eventApiUrl = 'http://localhost:8089/support/api/evenements';
  private readonly rappelApiUrl = 'http://localhost:8089/support/api/rappels';

  constructor(private http: HttpClient) {}

  getAllEvents(): Observable<EvenementCalendrierApi[]> {
    return this.http.get<EvenementCalendrierApi[]>(this.eventApiUrl);
  }

  createEvent(payload: EvenementCalendrierApi): Observable<EvenementCalendrierApi> {
    return this.http.post<EvenementCalendrierApi>(this.eventApiUrl, payload);
  }

  updateEvent(idEvent: number, payload: EvenementCalendrierApi): Observable<EvenementCalendrierApi> {
    return this.http.put<EvenementCalendrierApi>(`${this.eventApiUrl}/${idEvent}`, payload);
  }

  deleteEvent(idEvent: number): Observable<string> {
    return this.http.delete(`${this.eventApiUrl}/${idEvent}`, { responseType: 'text' });
  }

  createRappel(idEvent: number, payload: RappelApi): Observable<RappelApi> {
    return this.http.post<RappelApi>(`${this.rappelApiUrl}/event/${idEvent}`, payload);
  }
}
