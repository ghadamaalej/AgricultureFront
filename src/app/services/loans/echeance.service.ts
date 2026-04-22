import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Echeance } from 'src/app/loans/models/echeance';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class EcheanceService {

  constructor(private http: HttpClient) { }
private apiUrl = 'http://localhost:8089/pret/api/echeance';
  
  getEcheancesByPret(pretId: number): Observable<Echeance[]> {
  return this.http.get<Echeance[]>(
    `${this.apiUrl}/by-pret/${pretId}`
  );
}

getNext(pretId: number): Observable<Echeance> {
    return this.http.get<Echeance>(
      `${this.apiUrl}/next/${pretId}`
    );
  }

 
  payer(pretId: number): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/payer/${pretId}`,
      {}
    );
  }

  
  updateEcheance(e: Echeance): Observable<Echeance> {
    return this.http.put<Echeance>(
      `${this.apiUrl}/update`,
      e
    );
  }


}
