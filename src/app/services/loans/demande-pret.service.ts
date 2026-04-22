import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { Demande } from '../../loans/models/demande';

@Injectable({
  providedIn: 'root'
})
export class DemandePretService {

  private apiUrl = 'http://localhost:8089/pret/api/demandePret';
  private baseUrl = 'http://localhost:8089/pret';

  // Hardcode or inject from auth service
  private readonly TEMP_USER_ID = 1;

  constructor(private http: HttpClient) {}

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

  countByService(serviceId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count/${serviceId}`);
  }

  getByService(serviceId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/service/${serviceId}`);
  }

  getDocuments(id: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/${id}/documents`);
  }

  // NEW: fetches signed URL first, then fetches the actual file as ArrayBuffer
  getPdfAsArrayBuffer(demandeId: number, filename: string): Observable<ArrayBuffer> {
    return this.getSignedUrl(demandeId, filename).pipe(
      switchMap(signedPath => {
        const fullUrl = `${this.baseUrl}${signedPath}`;
        return this.http.get(fullUrl, { responseType: 'arraybuffer' });
      })
    );
  }

  // NEW: fetches signed URL first, then fetches image as Blob URL
  getImageAsObjectUrl(demandeId: number, filename: string): Observable<string> {
    return this.getSignedUrl(demandeId, filename).pipe(
      switchMap(signedPath => {
        const fullUrl = `${this.baseUrl}${signedPath}`;
        return this.http.get(fullUrl, { responseType: 'blob' });
      }),
      switchMap(blob => {
        return new Observable<string>(observer => {
          const objectUrl = URL.createObjectURL(blob);
          observer.next(objectUrl);
          observer.complete();
        });
      })
    );
  }

  private getSignedUrl(demandeId: number, filename: string): Observable<string> {
    return this.http.get(
      `${this.apiUrl}/${demandeId}/documents/${filename}/signed-url`,
      {
        params: { uid: this.TEMP_USER_ID, validity: 300000 },
        responseType: 'text'
      }
    );
  }

  calculateScore(id: number) {
  return this.http.post(
    `http://localhost:8089/pret/api/demandePret/${id}/score`,
    {}
  );
}
refuseDemande(id: number, motif: string) {
  return this.http.put(`http://localhost:8089/pret/api/demandePret/refuser/${id}`, {
    motif: motif
  });
}
getDemandesByAgriculteur(id: number) {
  return this.http.get<Demande[]>(
    `${this.apiUrl}/by-agriculteur/${id}`
  );
}
}