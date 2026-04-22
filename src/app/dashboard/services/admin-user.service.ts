import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {


  constructor(private http: HttpClient) {}

    getUserById(userId: number) {
    return this.http.get<any>(`http://localhost:8089/user/api/user/getUser/${userId}`);
  }
}