import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReponseIA {
  idReponseIA?: number;
  diagnostic: string;
  probabilite: number;
  recommandations: string;
  dateGeneration?: string;
  modele?: string;
  demandeId?: number;
}

export interface DemandeAssistance {
  idDemande?: number;
  typeProbleme: string;
  description: string;
  mediaUrl?: string;
  localisation?: string;
  dateCreation?: string;
  canal: string;
  statut?: string;
  userId?: number;
  reponseIA?: ReponseIA;
  affectationDemande?: AffectationDemande;
}

export interface AffectationDemande {
  idAffectation?: number;
  dateAffectation?: string;
  statut?: string;
  ingenieurId?: number;
  ingenieursRefuses?: string;
  demandeId?: number;
  reponsesIngenieur?: ReponseIngenieur[];
}

export interface ReponseIngenieur {
  idReponse?: number;
  contenu: string;
  dateReponse?: string;
  statut?: string;
  affectationId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AssistanceService {
  private apiUrl = 'http://localhost:8084/api/demandes';

  constructor(private http: HttpClient) {}

  getDemandeById(id: number): Observable<DemandeAssistance> {
    return this.http.get<DemandeAssistance>(`${this.apiUrl}/${id}`);
  }

  getAllDemandes(): Observable<DemandeAssistance[]> {
    return this.http.get<DemandeAssistance[]>(this.apiUrl);
  }

  getDemandesByUserId(userId: number): Observable<DemandeAssistance[]> {
    return this.http.get<DemandeAssistance[]>(`${this.apiUrl}/user/${userId}`);
  }

  createDemande(demande: DemandeAssistance): Observable<DemandeAssistance> {
    return this.http.post<DemandeAssistance>(this.apiUrl, demande);
  }

  generateAIResponse(id: number): Observable<ReponseIA> {
    return this.http.post<ReponseIA>(`${this.apiUrl}/${id}/generate-ai`, {});
  }

  acceptAffectation(affectationId: number, ingenieurId: number): Observable<AffectationDemande> {
    return this.http.post<AffectationDemande>(
      `http://localhost:8084/api/affectations/${affectationId}/accept?ingenieurId=${ingenieurId}`,
      {}
    );
  }

  refuseAffectation(affectationId: number, ingenieurId: number): Observable<AffectationDemande> {
    return this.http.post<AffectationDemande>(
      `http://localhost:8084/api/affectations/${affectationId}/refuse?ingenieurId=${ingenieurId}`,
      {}
    );
  }

  createEngineerResponse(affectationId: number, contenu: string): Observable<ReponseIngenieur> {
    return this.http.post<ReponseIngenieur>(
      `http://localhost:8084/api/affectations/${affectationId}/reponses`,
      { contenu, statut: 'PROPOSEE' }
    );
  }
}
