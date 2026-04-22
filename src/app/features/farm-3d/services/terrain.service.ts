import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Terrain } from '../models/terrain.model';

@Injectable({
  providedIn: 'root'
})
export class TerrainService {
  private apiUrl = 'http://localhost:8089/support/api/terrains'; 

  constructor(private http: HttpClient) {}

  getTerrains(): Observable<Terrain[]> {
    return this.http.get<Terrain[]>(this.apiUrl)
      .pipe(catchError(this.handleError));
  }

  getTerrain(id: number): Observable<Terrain> {
    return this.http.get<Terrain>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  createTerrain(terrain: Terrain): Observable<Terrain> {
    return this.http.post<Terrain>(this.apiUrl, terrain)
      .pipe(catchError(this.handleError));
  }

  updateTerrain(id: number, terrain: Terrain): Observable<Terrain> {
    return this.http.put<Terrain>(`${this.apiUrl}/${id}`, terrain)
      .pipe(catchError(this.handleError));
  }

  deleteTerrain(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Backend returned an unsuccessful response code
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }

    console.error('TerrainService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}