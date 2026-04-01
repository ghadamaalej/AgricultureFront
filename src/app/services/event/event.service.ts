import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Events } from '../../models/events';

@Injectable({
  providedIn: 'root'
})
export class EventService {
 private apiUrl = 'http://localhost:8089/evenement/api/event';

  constructor(private http: HttpClient) {}

  getAllEvents(): Observable<Events[]> {
    return this.http.get<Events[]>(`${this.apiUrl}/getAllEvents`);
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

}