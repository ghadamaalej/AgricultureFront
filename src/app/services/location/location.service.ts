import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  private api = 'http://localhost:8089/Vente/api/location';

  constructor(private http: HttpClient) {}

  getById(id: number) {
  return this.http.get<any>(`${this.api}/${id}`);
}

  
  create(data: any): Observable<any> {
    return this.http.post(this.api, data);
  }


  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.api);
  }

  
  update(id: number, data: any): Observable<any> {
    return this.http.put(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }

 hasActiveReservations(id: number) {
  return this.http.get<boolean>(
    `${this.api}/${id}/has-active-reservations`
  );
}

getDisponibilitesByLocation(id: number) {
  return this.http.get<any[]>(
    `${this.api}/${id}/disponibilites`
  );
}
}