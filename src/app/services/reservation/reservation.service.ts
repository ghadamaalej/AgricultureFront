import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  private stripeUrl = 'http://localhost:8089/evenement/api/payment';

  constructor(private http: HttpClient) {}

  addReservation(reservation: Reservation): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.baseUrl}/addReservation`, reservation);
  }

  getAll(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.baseUrl}/getAllReservations`);
  }
 getReservation(id: number): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.baseUrl}/getReservation/${id}`);
  }
 
  // ── Stripe ────────────────────────────────────────────────────────────────
 
  createPaymentIntent(reservationId: number): Observable<{ clientSecret: string; paymentIntentId: string }> {
    return this.http.post<{ clientSecret: string; paymentIntentId: string }>(
      `${this.stripeUrl}/create-payment-intent/${reservationId}`, {}
    );
  }
 
  confirmPayment(reservationId: number, paymentIntentId: string): Observable<Reservation> {
    const params = new HttpParams().set('paymentIntentId', paymentIntentId);
    return this.http.post<Reservation>(
      `${this.stripeUrl}/confirm-payment/${reservationId}`, {}, { params }
    );
  }
 
  cancelReservation(reservationId: number): Observable<{ status: string; message: string }> {
    return this.http.delete<{ status: string; message: string }>(
      `${this.stripeUrl}/cancel-reservation/${reservationId}`
    );
  }
 
  refundEvent(eventId: number): Observable<any> {
    return this.http.post(`${this.stripeUrl}/refund-event/${eventId}`, {});
  }
}