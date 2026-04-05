import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReservationVisiteService {
  private api = 'http://localhost:8089/Vente/reservations';

  constructor(private http: HttpClient) {}

  create(locationId: number, data: any) {
  return this.http.post(
    `http://localhost:8089/Vente/reservations/add/${locationId}`,
    data
  );
}

  getAll(): Observable<any> {
    return this.http.get(this.api);
  }

  cancelReservation(id: number): Observable<any> {
    return this.http.put(`${this.api}/cancel/${id}`, {});
  }

  getByUser(idUser: number): Observable<any> {
    return this.http.get(`${this.api}/user/${idUser}`);
  }
  update(reservationId: number, data: any) {
  return this.http.put(`${this.api}/update/${reservationId}`, data);
  }

  deleteReservation(id: number) {
  return this.http.delete(`${this.api}/delete/${id}`);
  }

  getByOwner(idUser: number) {
  return this.http.get(`${this.api}/owner/${idUser}`);
}

confirmReservation(id: number) {
  return this.http.put(`${this.api}/confirm/${id}`, {});
}

refuseReservation(id: number) {
  return this.http.put(`${this.api}/refuse/${id}`, {});
}

getReservationsByLocation(id: number) {
  return this.http.get<any[]>(
    `${this.api}/location/${id}`
  );
}
}