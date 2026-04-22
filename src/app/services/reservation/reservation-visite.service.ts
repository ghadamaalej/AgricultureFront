import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReservationVisiteService {
  private api = 'http://localhost:8089/Vente/reservations';

  constructor(private http: HttpClient) {}

  create(locationId: number, userId: number, data: any) {
    return this.http.post(
      `${this.api}/add/${locationId}?userId=${userId}`,
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
    return this.http.get<any[]>(`${this.api}/location/${id}`);
  }

  createRentalProposal(reservationId: number, userId: number, payload: any) {
  return this.http.post(
    `http://localhost:8089/Vente/api/proposition-location/reservation/${reservationId}?userId=${userId}`,
    payload
  );
}

getProposalsByAgriculteur(userId: number) {
  return this.http.get<any[]>(
    `http://localhost:8089/Vente/api/proposition-location/agriculteur/${userId}`
  );
}

acceptProposal(proposalId: number, agriculteurId: number) {
  return this.http.put(
    `http://localhost:8089/Vente/api/proposition-location/${proposalId}/accept?agriculteurId=${agriculteurId}`,
    {}
  );
}

refuseProposal(proposalId: number, agriculteurId: number, messageRefus: string) {
  return this.http.put(
    `http://localhost:8089/Vente/api/proposition-location/${proposalId}/refuse?agriculteurId=${agriculteurId}`,
    { messageRefus }
  );
}


saveContractInfo(proposalId: number, agriculteurId: number, payload: any) {
  return this.http.put(
    `http://localhost:8089/Vente/api/proposition-location/${proposalId}/contract-info?agriculteurId=${agriculteurId}`,
    payload
  );
}

getProposalsByLocataire(userId: number) {
  return this.http.get<any[]>(
    `http://localhost:8089/Vente/api/proposition-location/locataire/${userId}`
  );
}

getProposalById(proposalId: number) {
  return this.http.get<any>(
    `http://localhost:8089/Vente/api/proposition-location/${proposalId}`
  );
  
}

signContractByClient(proposalId: number, locataireId: number, payload: any) {
  return this.http.put(
    `http://localhost:8089/Vente/api/proposition-location/${proposalId}/sign-client?locataireId=${locataireId}`,
    payload
  );
}

getProposalsByLocation(locationId: number) {
  return this.http.get<any[]>(`http://localhost:8089/Vente/api/proposition-location/location/${locationId}`);
}

}