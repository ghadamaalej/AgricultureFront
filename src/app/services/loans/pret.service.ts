import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Pret } from '../../loans/models/pret';

@Injectable({
  providedIn: 'root'
})
export class PretService {

  private apiUrl = 'http://localhost:8089/pret/api/pret';

  constructor(private http: HttpClient) {}

  
  createPret(data: Pret): Observable<Pret> {
    return this.http.post<Pret>(`${this.apiUrl}/create-after-payment`, data);
  }
  getByDemande(demandeId: number): Observable<Pret> {
  return this.http.get<Pret>(`${this.apiUrl}/by-demande/${demandeId}`);
}

getPretsByAgriculteur(id: number): Observable<Pret[]> {
  return this.http.get<Pret[]>(`${this.apiUrl}/agriculteur/${id}`);
}
  
}