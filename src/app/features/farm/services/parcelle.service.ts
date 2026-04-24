import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Parcelle } from '../models/parcelle.model';

@Injectable({
  providedIn: 'root'
})
export class ParcelleService {
  private apiUrl = '/support/api/parcelles';

  constructor(private http: HttpClient) {}

  getParcellesByTerrain(terrainId: number): Observable<Parcelle[]> {
    return this.http.get<Parcelle[]>(`${this.apiUrl}/terrain/${terrainId}`)
      .pipe(catchError(this.handleError));
  }

  getParcelle(id: number): Observable<Parcelle> {
    return this.http.get<Parcelle>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  createParcelle(terrainId: number, parcelle: Parcelle): Observable<Parcelle> {
    return this.http.post<Parcelle>(`${this.apiUrl}/terrain/${terrainId}`, parcelle)
      .pipe(catchError(this.handleError));
  }

  updateParcelle(id: number, parcelle: Parcelle): Observable<Parcelle> {
    return this.http.put<Parcelle>(`${this.apiUrl}/${id}`, parcelle)
      .pipe(catchError(this.handleError));
  }

  deleteParcelle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }

    console.error('ParcelleService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
