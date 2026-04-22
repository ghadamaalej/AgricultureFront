// contrat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContratService {

  private apiUrl = 'http://localhost:8089/pret/api/contrat';

  constructor(private http: HttpClient) {}

  generateContrat(demandeId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/generate/${demandeId}`, {});
  }

  getContratByDemande(demandeId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/by-demande/${demandeId}`);
  }

 signContrat(contratId: number, signatureBase64: string): Observable<any> {
  return this.http.post(`${this.apiUrl}/sign`, {
    contratId: Number(contratId),
    signatureBase64: signatureBase64
  });
}
  getContrat(id: number): Observable<any> {
  return this.http.get(`${this.apiUrl}/getContrat/${id}`);
}
}