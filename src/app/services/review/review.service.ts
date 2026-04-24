import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private apiUrl = 'http://localhost:8089/Vente/api/reviews';

  constructor(private http: HttpClient) {}

  getReviews(targetType: 'PRODUCT' | 'RENTAL', targetId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${targetType}/${targetId}`);
  }

  getEligibility(targetType: 'PRODUCT' | 'RENTAL', targetId: number, userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/eligibility/${targetType}/${targetId}?userId=${userId}`);
  }

  addReview(targetType: 'PRODUCT' | 'RENTAL', targetId: number, payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${targetType}/${targetId}`, payload);
  }

  updateReview(targetType: 'PRODUCT' | 'RENTAL', targetId: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${targetType}/${targetId}`, payload);
  }
}