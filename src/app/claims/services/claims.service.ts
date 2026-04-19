import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ReclamationResponse,
  CreateReclamationRequest,
  AddMessageRequest,
  UpdateStatusRequest,
  ReclamationStatus
} from '../models/claims.models';

@Injectable({ providedIn: 'root' })
export class ClaimsService {

  // Backend runs on port 8095 with context-path /reclamations
  private readonly BASE = 'http://localhost:8095/reclamations/api/reclamations';

  constructor(private http: HttpClient) {}

  /** Admin: get all reclamations, optionally filtered by status */
  getAll(status?: ReclamationStatus): Observable<ReclamationResponse[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ReclamationResponse[]>(this.BASE, { params });
  }

  /** User: get their reclamations */
  getByUser(userId: number): Observable<ReclamationResponse[]> {
    return this.http.get<ReclamationResponse[]>(`${this.BASE}/user/${userId}`);
  }

  /** Get single reclamation */
  getById(id: number): Observable<ReclamationResponse> {
    return this.http.get<ReclamationResponse>(`${this.BASE}/${id}`);
  }

  /** Create a new reclamation */
  create(request: CreateReclamationRequest): Observable<ReclamationResponse> {
    return this.http.post<ReclamationResponse>(this.BASE, request);
  }

  /** Add a message to existing reclamation */
  addMessage(id: number, request: AddMessageRequest): Observable<ReclamationResponse> {
    return this.http.post<ReclamationResponse>(`${this.BASE}/${id}/messages`, request);
  }

  /** Admin: update reclamation status */
  updateStatus(id: number, request: UpdateStatusRequest): Observable<ReclamationResponse> {
    return this.http.patch<ReclamationResponse>(`${this.BASE}/${id}/status`, request);
  }
}
