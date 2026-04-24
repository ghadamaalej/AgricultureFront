import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RentalPaymentService {

  private apiUrl = 'http://localhost:8089/paiement/api/v1/rental-payments';

  constructor(private http: HttpClient) {}

  getPaymentsByProposition(propositionId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/proposition/${propositionId}`);
  }

  setupCard(propositionId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/setup-card/${propositionId}`, {});
  }

  chargeDueNow(): Observable<any> {
  return this.http.post(`${this.apiUrl}/charge-due-now`, {}, { responseType: 'text' as 'json' });
}
}