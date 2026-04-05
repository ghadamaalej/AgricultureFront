import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DisponibiliteService {
  private api = 'http://localhost:8089/Vente/disponibilites';

  constructor(private http: HttpClient) {}

  create(data: any): Observable<any> {
    return this.http.post(this.api, data);
  }

  createMany(items: any[]): Observable<any[]> {
    return forkJoin(items.map(item => this.create(item)));
  }

  getAll() {
  return this.http.get<any>(this.api);
  }

  getByLocation(locationId: number) {
    return this.http.get<any>(`${this.api}/search/findByLocationId?idLocation=${locationId}`);
  }
  getByLocationAndDay(locationId: number, jourSemaine: string) {
    return this.http.get<any[]>(
      `${this.api}/by-location-and-day?locationId=${locationId}&jourSemaine=${jourSemaine}`
    );
}
updateForLocation(locationId: number, dispos: any[]) {
  return this.http.put(
    `${this.api}/location/${locationId}`,
    dispos
  );
}


}