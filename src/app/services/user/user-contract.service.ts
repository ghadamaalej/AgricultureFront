import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class UserContractService {

  constructor(private http: HttpClient) {}

  getUserById(userId: number) {
    return this.http.get<any>(`http://localhost:8089/user/api/user/getUser/${userId}`);
  }
}