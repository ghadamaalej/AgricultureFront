import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Demande } from '../../loans/models/demande';

@Injectable({
  providedIn: 'root'
})
export class DemandePretService {

  private apiUrl = 'http://localhost:8089/pret/api/demandePret';

  constructor(private http: HttpClient) { }

  getAll(): Observable<Demande[]> {
    return this.http.get<Demande[]>(`${this.apiUrl}/getAll`);
  }

  getById(id: number): Observable<Demande> {
    return this.http.get<Demande>(`${this.apiUrl}/get/${id}`);
  }

  createDemande(demande: Demande): Observable<Demande> {
    return this.http.post<Demande>(`${this.apiUrl}/add`, demande);
  }
  uploadDocuments(demandeId: number, formData: FormData): Observable<any> {
  return this.http.post(`${this.apiUrl}/${demandeId}/documents`, formData);
}
}