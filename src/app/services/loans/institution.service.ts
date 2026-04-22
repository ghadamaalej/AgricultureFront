import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Institution } from '../../loans/models/institution';
@Injectable({
  providedIn: 'root'
})
export class InstitutionService {

  constructor(private http: HttpClient) { }
   private apiUrl = 'http://localhost:8089/user/api/user';

    getInstitutions() {
    return this.http.get<Institution[]>(`${this.apiUrl}/institutions`);
  }
  
}
