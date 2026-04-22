import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaimentService {

   private apiUrl = 'http://localhost:8089/pret/api/paiement';

  constructor(private http: HttpClient) {}

  createIntent(montant: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/create-intent?montant=${montant}`, {});
  }

  createBankIntent(montant: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/create-bank-intent?montant=${montant}`, {});
  }
  createAgriculteurIntent(pretId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/create-agriculteur-intent/${pretId}`,
      {}
    );
  }

}
