import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Reservation {
  id?: number;
  nbPlaceReserve: number;
  montant: number;
  etatPaiement?: string;
  dateInscription?: string;
  evenement: { id: number };
  id_user: number;
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private baseUrl = 'http://localhost:8089/evenement/api/reservation';

  constructor(private http: HttpClient) {}

  addReservation(reservation: Reservation): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.baseUrl}/addReservation`, reservation);
  }

  getAll(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.baseUrl}/getAllReservations`);
  }
}