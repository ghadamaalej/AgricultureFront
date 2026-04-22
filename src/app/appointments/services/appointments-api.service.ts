import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import {
  VetUser, VetAvailability, AppointmentResponse,
  CreateAppointmentRequest, CreateAvailabilityRequest,
  CreateUnavailabilityRequest, UnavailabilityResponse,
  HealthRecord, CreateHealthRecordRequest, UpdateHealthRecordRequest,
  ChatConversation, ChatMessage , AppointmentStats,
  DiagnosticRequest, DiagnosticResponse, DiagnosticChatResponse,
  MedicalAssistantRequest, MedicalAssistantResponse,DiagnosticAssistantChatRequest, ImageChatbotResponse,
  CreateAvisRequest,
  AvisResponse,
  VetRatingSummary,
  CommentaireAvisResponse,
  ReponseAvisResponse , 
} from '../models/appointments.models';

interface ApiResp<T> { message: string; data: T; }


/** Spring Boot without Jackson config sends LocalDate/LocalDateTime as arrays.
 *  Normalize both formats to ISO string. */
function normDate(v: any): string | null {
  if (!v) return null;
  // Already an ISO string: "2026-04-26" or "2026-04-26T09:30:00"
  if (typeof v === 'string') return v.length > 10 ? v : v;
  // Array format from Jackson without jsr310: [2026,4,26] or [2026,4,26,9,30,0]
  if (Array.isArray(v)) {
    const [y, mo, d, h = 0, mi = 0] = v;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h || mi
      ? `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00`
      : `${y}-${pad(mo)}-${pad(d)}`;
  }
  // Object format from Jackson: {year:2026, monthValue:4, dayOfMonth:26}
  if (typeof v === 'object') {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y  = v.year       ?? v.Year       ?? 0;
    const mo = v.monthValue ?? v.month      ?? v.MonthValue ?? 1;
    const d  = v.dayOfMonth ?? v.day        ?? v.DayOfMonth ?? 1;
    const h  = v.hour       ?? v.Hour       ?? 0;
    const mi = v.minute     ?? v.Minute     ?? 0;
    return (h || mi)
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

  // ── Health Records ─────────────────────────────────────────
  getHealthRecordsByAnimal(animalId: number): Observable<HealthRecord[]> {
    return this.http.get<ApiResp<HealthRecord[]>>(
      `${this.inv}/health-records/animal/${animalId}`, { headers: this.h() }
    ).pipe(map(r => (r.data || []).map((h: any) => ({
      ...h,
      dateH: normDate(h.dateH)
    }))));
  }

  createHealthRecord(req: CreateHealthRecordRequest): Observable<HealthRecord> {
    return this.http.post<ApiResp<HealthRecord>>(
      `${this.inv}/health-records`, req, { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  updateHealthRecord(id: number, req: UpdateHealthRecordRequest): Observable<HealthRecord> {
    return this.http.put<ApiResp<HealthRecord>>(
      `${this.inv}/health-records/${id}`, req, { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  deleteHealthRecord(id: number): Observable<void> {
    return this.http.delete<ApiResp<void>>(
      `${this.inv}/health-records/${id}`, { headers: this.h() }
    ).pipe(map(() => void 0));
  }

  // ── CHAT ───────────────────────────────────────────────────
  askMedicalAssistant(animalId: number, req: MedicalAssistantRequest): Observable<MedicalAssistantResponse> {
    return this.http.post<ApiResp<MedicalAssistantResponse>>(
      `${this.inv}/health-records/animal/${animalId}/assistant`,
      req,
      { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  getMyConversations(): Observable<ChatConversation[]> {
    return this.http.get<ApiResp<ChatConversation[]>>(
      `${this.inv}/messages/conversations`, { headers: this.h() }
    ).pipe(map(r => (r.data || []).map((c: any) => ({
      ...c,
      lastMessageAt: normDate(c.lastMessageAt)
    }))));
  }

  createOrGetConversation(veterinarianId: number): Observable<ChatConversation> {
    return this.http.post<ApiResp<ChatConversation>>(
      `${this.inv}/messages/conversations`, { veterinarianId }, { headers: this.h() }
    ).pipe(map(r => ({ ...r.data, lastMessageAt: normDate((r.data as any)?.lastMessageAt) })));
  }

  getConversationMessages(conversationId: number): Observable<ChatMessage[]> {
    return this.http.get<ApiResp<ChatMessage[]>>(
      `${this.inv}/messages/conversations/${conversationId}/messages`, { headers: this.h() }
    ).pipe(map(r => (r.data || []).map((m: any) => this.normalizeChatMessage(m))));
  }

 sendConversationMessage(conversationId: number, content: string): Observable<ChatMessage> {
  return this.http.post<ApiResp<ChatMessage>>(
    `${this.inv}/messages/conversations/${conversationId}/messages`,
    { content },
    { headers: this.h() }
  ).pipe(
    map(r => this.normalizeChatMessage(r.data))
  );
}

sendConversationAttachment(conversationId: number, file: File, content?: string): Observable<ChatMessage> {
  const formData = new FormData();
  formData.append('file', file);
  if (content && content.trim()) {
    formData.append('content', content.trim());
  }
  return this.http.post<ApiResp<ChatMessage>>(
    `${this.inv}/messages/conversations/${conversationId}/attachments`,
    formData,
    { headers: this.h() }
  ).pipe(map(r => this.normalizeChatMessage(r.data)));
}
private normalizeChatMessage(message: any): ChatMessage {
 const rawUrl = message?.attachmentUrl ? String(message.attachmentUrl) : null;
  return {
    ...message,
    messageType: message?.messageType || 'TEXT',
    attachmentUrl: rawUrl,
    sentAt: normDate(message?.sentAt) ?? ''
  } as ChatMessage;
}


getVetStats(vetId: number): Observable<AppointmentStats> {
  return this.http.get<ApiResp<AppointmentStats>>(
    `${this.inv}/appointments/vet/${vetId}/stats`,
    { headers: this.h() }
  ).pipe(map(r => r.data));
}

getFarmerStats(farmerId: number): Observable<AppointmentStats> {
  return this.http.get<ApiResp<AppointmentStats>>(
    `${this.inv}/appointments/farmer/${farmerId}/stats`,
    { headers: this.h() }
  ).pipe(map(r => r.data));
}

diagnoseAnimal(req: DiagnosticRequest): Observable<DiagnosticResponse> {
  return this.http.post<ApiResp<DiagnosticResponse>>(
    `${this.inv}/diagnostic`,
    req,
    { headers: this.h() }
  ).pipe(map(r => r.data));
}

chatWithDiagnosticAssistant(req: DiagnosticRequest): Observable<DiagnosticChatResponse> {
  return this.http.post<ApiResp<DiagnosticChatResponse>>(
    `${this.inv}/diagnostic/chat`,
    req,
    { headers: this.h() }
  ).pipe(map(r => r.data));
}

chatWithIndependentAssistant(req: DiagnosticAssistantChatRequest): Observable<DiagnosticChatResponse> {
  return this.http.post<ApiResp<DiagnosticChatResponse>>(
    `${this.inv}/diagnostic/assistant/chat`,
    req,
    { headers: this.h() }
  ).pipe(map(r => r.data));
}
analyzeChatbotImage(file: File, question = '', audience = 'farmer'): Observable<ImageChatbotResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('question', question);
  formData.append('audience', audience);

  return this.http.post<ApiResp<ImageChatbotResponse>>(
    `${this.inv}/diagnostic/image-chatbot`,
    formData,
    { headers: this.h() }
  ).pipe(map(r => r.data));
}
 /**
   * Récupère la liste des avis d'un vétérinaire.
   * Les données likedByMe sont calculées côté backend selon l'utilisateur JWT.
   */
  getAvisByVet(vetId: number): Observable<AvisResponse[]> {
    return this.http.get<ApiResp<AvisResponse[]>>(
      `${this.inv}/avis/vet/${vetId}`,
      { headers: this.h() }
    ).pipe(map(r => (r.data || []).map((a: any) => ({
      ...a,
      createdAt: normDate(a.createdAt),
      reponseVet: a.reponseVet ? { ...a.reponseVet, createdAt: normDate(a.reponseVet.createdAt) } : null,
      commentaires: (a.commentaires || []).map((c: any) => ({ ...c, createdAt: normDate(c.createdAt) }))
    }))));
  }

  /**
   * Récupère le résumé de notation d'un vétérinaire
   * (moyenne étoiles, total avis, distribution par note).
   */
  getVetRatingSummary(vetId: number): Observable<VetRatingSummary> {
    return this.http.get<ApiResp<VetRatingSummary>>(
      `${this.inv}/avis/vet/${vetId}/summary`,
      { headers: this.h() }
    ).pipe(map(r => r.data));
  }

  /**
   * Crée un nouvel avis (agriculteur → vétérinaire).
   * Un agriculteur ne peut donner qu'un seul avis par vétérinaire.
   */
  createAvis(req: CreateAvisRequest): Observable<AvisResponse> {
    return this.http.post<ApiResp<AvisResponse>>(
      `${this.inv}/avis`,
      req,
      { headers: this.h() }
    ).pipe(map(r => ({ ...r.data, createdAt: normDate(r.data.createdAt) } as AvisResponse)));
  }

  /**
   * Toggle le like d'un agriculteur sur un avis.
   * Si déjà liké → retire le like. Sinon → ajoute le like.
   */
  toggleLike(avisId: number): Observable<void> {
    return this.http.post<void>(
      `${this.inv}/avis/${avisId}/like`,
      {},
      { headers: this.h() }
    );
  }

  /**
   * Ajoute un commentaire (réponse d'un agriculteur) sur un avis.
   */
  addCommentaire(avisId: number, contenu: string): Observable<CommentaireAvisResponse> {
    return this.http.post<ApiResp<CommentaireAvisResponse>>(
      `${this.inv}/avis/${avisId}/commentaires`,
      { contenu },
      { headers: this.h() }
    ).pipe(map(r => ({ ...r.data, createdAt: normDate(r.data.createdAt) } as CommentaireAvisResponse)));
  }

  /**
   * Ajoute la réponse officielle du vétérinaire à un avis.
   * Un vétérinaire ne peut répondre qu'une seule fois par avis.
   */
  addReponseVet(avisId: number, contenu: string): Observable<ReponseAvisResponse> {
    return this.http.post<ApiResp<ReponseAvisResponse>>(
      `${this.inv}/avis/${avisId}/reponse`,
      { contenu },
      { headers: this.h() }
    ).pipe(map(r => ({ ...r.data, createdAt: normDate(r.data.createdAt) } as ReponseAvisResponse)));
  }
  analyzePoultryChatbotImage(file: File, question = '', audience = 'farmer'): Observable<ImageChatbotResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('question', question);
  formData.append('audience', audience);

  return this.http.post<ApiResp<ImageChatbotResponse>>(
    `${this.inv}/diagnostic/poultry-image-chatbot`,
    formData,
    { headers: this.h() }
  ).pipe(map(r => r.data));
}

}