import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Service } from '../../loans/models/service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ServicePretService {

  private apiUrl = 'http://localhost:8089/pret/api/servicePret';

  constructor(private http: HttpClient) { }

  getAll(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.apiUrl}/getAll`);
  }
  getALLById(agentId: number):Observable<Service[]> {
return this.http.get<Service[]>(`${this.apiUrl}/getAll/${agentId}`);}

  getById(id: number): Observable<Service> {
    return this.http.get<Service>(`${this.apiUrl}/get/${id}`);
  }

  create(service: Service): Observable<Service> {
    return this.http.post<Service>(`${this.apiUrl}/add`, service);
  }

 update(id: number, service: Service): Observable<Service> {
  return this.http.put<Service>(`${this.apiUrl}/update/${id}`, service);
}

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/delete/${id}`);
  }
}