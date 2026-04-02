import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import {
  VetUser, VetAvailability, AppointmentResponse,
  CreateAppointmentRequest, CreateAvailabilityRequest,
  CreateUnavailabilityRequest, UnavailabilityResponse
} from '../models/appointments.models';

interface ApiResp<T> { message: string; data: T; }

/** Spring Boot without Jackson config sends LocalDate/LocalDateTime as arrays.
 *  Normalize both formats to ISO string. */
function normDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  // Array format: [2026,4,1] or [2026,4,1,9,30,0]
  if (Array.isArray(v)) {
    const [y, mo, d, h = 0, mi = 0] = v;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h || mi
      ? `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00`
      : `${y}-${pad(mo)}-${pad(d)}`;
  }
  return String(v);
}

function normalizeAppointment(a: any): any {
  if (!a) return a;
  return {
    ...a,
    dateHeure: normDate(a.dateHeure),
    createdAt: normDate(a.createdAt),
    timeSlot: a.timeSlot ? {
      ...a.timeSlot,
      date: normDate(a.timeSlot.date),
    } : null,
  };
}

function normalizeAvailability(av: any): any {
  if (!av) return av;
  return {
    ...av,
    date: normDate(av.date),
    timeSlots: (av.timeSlots || []).map((s: any) => ({
      ...s,
      date: normDate(s.date),
    }))
  };
}

@Injectable({ providedIn: 'root' })
export class AppointmentsApiService {
  // Gestion-Inventaire: port 8088, context-path /inventaires
  private inv = 'http://localhost:8088/inventaires/api';
  // Gestion-User: port 8081, no context-path
  private usr = 'http://localhost:8081/api';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private h(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  // ── USER SERVICE ──────────────────────────────────────────────
  getAllVets(): Observable<VetUser[]> {
    return this.http.get<VetUser[]>(`${this.usr}/user/getAll`).pipe(
      map((users: any[]) => users.filter(u => u.role === 'VETERINAIRE'))
    );
  }

  getVetById(id: number): Observable<VetUser> {
    return this.http.get<VetUser>(`${this.usr}/user/getUser/${id}`);
  }

  updateVetProfile(user: any): Observable<VetUser> {
    return this.http.put<VetUser>(`${this.usr}/user/updateaUser`, user);
  }

  // ── AVAILABILITIES ────────────────────────────────────────────
  getVetAvailabilities(vetId: number): Observable<VetAvailability[]> {
    return this.http.get<ApiResp<VetAvailability[]>>(
      `${this.inv}/availabilities/veterinarian/${vetId}`, { headers: this.h() }
    ).pipe(map(r => (r.data || []).map(normalizeAvailability)));
  }

  getMyAvailabilities(): Observable<VetAvailability[]> {
    return this.http.get<ApiResp<VetAvailability[]>>(
      `${this.inv}/availabilities/my`, { headers: this.h() }
    ).pipe(map(r => (r.data || []).map(normalizeAvailability)));
  }

  createAvailability(req: CreateAvailabilityRequest): Observable<VetAvailability> {
    return this.http.post<ApiResp<VetAvailability>>(
      `${this.inv}/availabilities`, req, { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  blockDay(date: string): Observable<void> {
    return this.http.put<ApiResp<void>>(
      `${this.inv}/availabilities/block-day`, { date }, { headers: this.h() }
    ).pipe(map(() => void 0));
  }

  // ── UNAVAILABILITIES ──────────────────────────────────────────
  getMyUnavailabilities(): Observable<UnavailabilityResponse[]> {
    return this.http.get<ApiResp<UnavailabilityResponse[]>>(
      `${this.inv}/unavailabilities`, { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  createUnavailability(req: CreateUnavailabilityRequest): Observable<void> {
    return this.http.post<ApiResp<void>>(
      `${this.inv}/unavailabilities`, req, { headers: this.h() }
    ).pipe(map(() => void 0));
  }

  deleteUnavailability(id: number): Observable<void> {
    return this.http.delete<ApiResp<void>>(
      `${this.inv}/unavailabilities/${id}`, { headers: this.h() }
    ).pipe(map(() => void 0));
  }

  // ── APPOINTMENTS ──────────────────────────────────────────────
  createAppointment(req: CreateAppointmentRequest): Observable<AppointmentResponse> {
    return this.http.post<ApiResp<AppointmentResponse>>(
      `${this.inv}/appointments`, req, { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  getFarmerAppointments(farmerId: number): Observable<AppointmentResponse[]> {
    return this.http.get<ApiResp<AppointmentResponse[]>>(
      `${this.inv}/appointments/farmer/${farmerId}`, { headers: this.h() }
    ).pipe(map(r => (r.data || []).map(normalizeAppointment)));
  }

  getVetAppointments(vetId: number): Observable<AppointmentResponse[]> {
    return this.http.get<ApiResp<AppointmentResponse[]>>(
      `${this.inv}/appointments/vet/${vetId}`, { headers: this.h() }
    ).pipe(map(r => (r.data || []).map(normalizeAppointment)));
  }

  cancelAppointment(id: number): Observable<AppointmentResponse> {
    return this.http.put<ApiResp<AppointmentResponse>>(
      `${this.inv}/appointments/${id}/cancel`, {}, { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  acceptAppointment(id: number): Observable<AppointmentResponse> {
    return this.http.put<ApiResp<AppointmentResponse>>(
      `${this.inv}/appointments/${id}/accept`, {}, { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  refuseAppointment(id: number, reason: string): Observable<AppointmentResponse> {
    return this.http.put<ApiResp<AppointmentResponse>>(
      `${this.inv}/appointments/${id}/refuse?reason=${encodeURIComponent(reason)}`,
      {}, { headers: this.h() }
    ).pipe(map(r => r.data));
  }
}
