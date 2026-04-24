import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Culture, CultureCreatePayload } from '../models/parcelle.model';

@Injectable({
  providedIn: 'root'
})
export class CultureService {
  private apiUrl = '/support/api/cultures';

  constructor(private http: HttpClient) {}

  getCulturesByParcelle(parcelleId: number): Observable<Culture[]> {
    return this.http
      .get<Culture[]>(`${this.apiUrl}/parcelle/${parcelleId}`)
      .pipe(catchError(this.handleError));
  }

  getCulture(id: number): Observable<Culture> {
    return this.http.get<Culture>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  createCulture(parcelleId: number, payload: CultureCreatePayload): Observable<Culture> {
    return this.http
      .post<Culture>(`${this.apiUrl}/parcelle/${parcelleId}`, payload)
      .pipe(catchError(this.handleError));
  }

  updateCulture(id: number, culture: Culture): Observable<Culture> {
    return this.http.put<Culture>(`${this.apiUrl}/${id}`, culture)
      .pipe(catchError(this.handleError));
  }

  deleteCulture(id: number): Observable<void> {
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

    console.error('CultureService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
