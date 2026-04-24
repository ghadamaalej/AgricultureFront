import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class AiEventService {
    private baseUrl = 'http://localhost:8089/evenement/api/ai_event';

  constructor(private http: HttpClient) {}

  chat(messages: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/chat`, { messages });
  }
}