import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import {
  ReclamationResponse,
  CreateReclamationRequest,
  AddMessageRequest,
  UpdateStatusRequest,
  ReclamationStatus,
  ReclamationCategory,
  ReclamationPriority,
  ReclamationMessageResponse
} from '../models/claims.models';

type AssistanceStatus =
  | 'OUVERTE'
  | 'EN_ATTENTE_IA'
  | 'EN_ATTENTE_INGENIEUR'
  | 'EN_COURS'
  | 'RESOLUE'
  | 'FERMEE';

interface AssistanceResponse {
  idDemande: number;
  typeProbleme: string | null;
  description: string;
  mediaUrl: string | null;
  localisation: string | null;
  dateCreation: string;
  canal: string | null;
  statut: AssistanceStatus | null;
  userId: number;
  reponseIA?: {
    diagnostic?: string | null;
    recommandations?: string | null;
    dateGeneration?: string | null;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class ClaimsService {

  private readonly BASE = '/assistance/api/demandes';

  constructor(private http: HttpClient) {}

  getAll(status?: ReclamationStatus): Observable<ReclamationResponse[]> {
    return this.http.get<AssistanceResponse[]>(this.BASE).pipe(
      map(items => items.map(item => this.mapResponse(item))),
      map(items => status ? items.filter(item => item.status === status) : items)
    );
  }

  getByUser(userId: number): Observable<ReclamationResponse[]> {
    return this.http.get<AssistanceResponse[]>(`${this.BASE}/user/${userId}`).pipe(
      map(items => items.map(item => this.mapResponse(item)))
    );
  }

  getById(id: number): Observable<ReclamationResponse> {
    return this.http.get<AssistanceResponse>(`${this.BASE}/${id}`).pipe(
      map(item => this.mapResponse(item))
    );
  }

  create(request: CreateReclamationRequest): Observable<ReclamationResponse> {
    const payload = {
      userId: request.userId,
      typeProbleme: this.mapCategoryToProblemType(request.category),
      description: request.description,
      localisation: request.subject,
      mediaUrl: null,
      canal: this.mapPriorityToCanal(request.priority),
      statut: 'OUVERTE'
    };

    return this.http.post<AssistanceResponse>(this.BASE, payload).pipe(
      map(item => this.mapResponse(item, request))
    );
  }

  addMessage(id: number, request: AddMessageRequest): Observable<ReclamationResponse> {
    return this.getById(id).pipe(
      map(claim => {
        const syntheticMessage: ReclamationMessageResponse = {
          id: Date.now(),
          senderId: request.senderId,
          senderName: request.senderRole === 'ADMIN' ? 'Admin' : 'Vous',
          senderRole: request.senderRole,
          message: request.message,
          createdAt: new Date().toISOString()
        };

        return { ...claim, messages: [...claim.messages, syntheticMessage] };
      })
    );
  }

  updateStatus(id: number, request: UpdateStatusRequest): Observable<ReclamationResponse> {
    return this.http.get<AssistanceResponse>(`${this.BASE}/${id}`).pipe(
      switchMap(current => this.http.put<AssistanceResponse>(`${this.BASE}/${id}`, {
        ...current,
        statut: this.mapStatusToAssistance(request.status)
      })),
      map(item => this.mapResponse(item))
    );
  }

  private mapResponse(item: AssistanceResponse, source?: Partial<CreateReclamationRequest>): ReclamationResponse {
    const aiMessages = this.extractAiMessages(item);

    return {
      id: item.idDemande,
      userId: item.userId,
      userFullName: source?.userId === item.userId ? `Utilisateur #${item.userId}` : `Utilisateur #${item.userId}`,
      userEmail: '',
      subject: item.localisation || `Demande #${item.idDemande}`,
      category: this.mapProblemTypeToCategory(item.typeProbleme),
      description: item.description,
      status: this.mapStatusFromAssistance(item.statut),
      priority: this.mapCanalToPriority(item.canal),
      createdAt: item.dateCreation,
      updatedAt: item.reponseIA?.dateGeneration || item.dateCreation,
      closedAt: item.statut === 'RESOLUE' || item.statut === 'FERMEE'
        ? (item.reponseIA?.dateGeneration || item.dateCreation)
        : null,
      messages: aiMessages
    };
  }

  private extractAiMessages(item: AssistanceResponse): ReclamationMessageResponse[] {
    const messages: ReclamationMessageResponse[] = [];

    if (item.reponseIA?.diagnostic) {
      messages.push({
        id: item.idDemande * 1000 + 1,
        senderId: 0,
        senderName: 'Assistant IA',
        senderRole: 'ADMIN',
        message: item.reponseIA.diagnostic,
        createdAt: item.reponseIA.dateGeneration || item.dateCreation
      });
    }

    if (item.reponseIA?.recommandations) {
      messages.push({
        id: item.idDemande * 1000 + 2,
        senderId: 0,
        senderName: 'Assistant IA',
        senderRole: 'ADMIN',
        message: item.reponseIA.recommandations,
        createdAt: item.reponseIA.dateGeneration || item.dateCreation
      });
    }

    return messages;
  }

  private mapStatusFromAssistance(status: AssistanceStatus | null): ReclamationStatus {
    switch (status) {
      case 'EN_COURS':
      case 'EN_ATTENTE_IA':
      case 'EN_ATTENTE_INGENIEUR':
        return 'EN_COURS';
      case 'RESOLUE':
        return 'RESOLUE';
      case 'FERMEE':
        return 'REJETEE';
      case 'OUVERTE':
      default:
        return 'EN_ATTENTE';
    }
  }

  private mapStatusToAssistance(status: ReclamationStatus): AssistanceStatus {
    switch (status) {
      case 'EN_COURS':
        return 'EN_COURS';
      case 'RESOLUE':
        return 'RESOLUE';
      case 'REJETEE':
        return 'FERMEE';
      case 'EN_ATTENTE':
      default:
        return 'OUVERTE';
    }
  }

  private mapProblemTypeToCategory(typeProbleme: string | null): ReclamationCategory {
    switch (typeProbleme) {
      case 'MATERIEL':
        return 'INVENTAIRE';
      case 'IRRIGATION':
      case 'CULTURE':
      case 'FERTILISATION':
      case 'MALADIE_PLANTE':
      case 'MALADIE_ANIMALE':
      case 'ELEVAGE':
        return 'RENDEZ_VOUS';
      default:
        return 'AUTRE';
    }
  }

  private mapCategoryToProblemType(category: ReclamationCategory): string {
    switch (category) {
      case 'INVENTAIRE':
        return 'MATERIEL';
      case 'RENDEZ_VOUS':
        return 'ELEVAGE';
      case 'LIVRAISON':
        return 'IRRIGATION';
      case 'COMMANDE':
        return 'CULTURE';
      case 'PAIEMENT':
        return 'FERTILISATION';
      case 'COMPTE':
        return 'AUTRE';
      case 'AUTRE':
      default:
        return 'AUTRE';
    }
  }

  private mapCanalToPriority(canal: string | null): ReclamationPriority {
    switch (canal) {
      case 'MIXTE':
        return 'HAUTE';
      case 'INGENIEUR':
        return 'MOYENNE';
      case 'IA':
      default:
        return 'BASSE';
    }
  }

  private mapPriorityToCanal(priority: ReclamationPriority): string {
    switch (priority) {
      case 'HAUTE':
        return 'MIXTE';
      case 'MOYENNE':
        return 'INGENIEUR';
      case 'BASSE':
      default:
        return 'IA';
    }
  }
}
