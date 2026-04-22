import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiRecipeService {
  private apiUrl = 'http://localhost:8089/Vente/api/ai';

  constructor(private http: HttpClient) {}

  generateRecipeCart(payload: {
    userId: number;
    prompt: string;
    addToCart: boolean;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/recipe-cart`, payload);
  }
}