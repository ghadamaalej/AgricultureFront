import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Formation {
  idFormation?: number;
  titre: string;
  description: string;
  thematique: string;
  niveau: string;
  type: string;
  prix: number;
  estPayante: boolean;
  langue: string;
  dateCreation?: string;
  imageUrl?: string;
  statut?: string;
  userId?: number;
  modules?: Module[];
  ressources?: Ressource[];
  inscriptions?: InscriptionFormation[];
}

export interface Module {
  idModule?: number;
  titre: string;
  ordre: number;
  lecons?: LeconVideo[];
  ressources?: Ressource[];
}

export interface LeconVideo {
  idLecon?: number;
  titre: string;
  urlVideo: string;
  dureeSecondes: number;
  ordre: number;
  estGratuitePreview?: boolean;
  liveAt?: string;
  streamingRoom?: string;
  commentaires?: LeconCommentaire[];
}

export interface Ressource {
  idRessource?: number;
  titre: string;
  type: string;
  url: string;
}

export interface LeconCommentaire {
  idCommentaire?: number;
  contenu: string;
  auteurId?: number;
  auteurNom?: string;
  dateCreation?: string;
}

export interface InscriptionFormation {
  idInscription?: number;
  dateInscription?: string;
  statutAcces?: string;
  progression?: number;
  userId: number;
  paiementId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FormationService {
  private apiUrl = 'http://localhost:8089/formation/api/formations';

  constructor(private http: HttpClient) {}

  // Formation endpoints
  getAllFormations(): Observable<Formation[]> {
    return this.http.get<Formation[]>(this.apiUrl);
  }

  getFormationById(id: number): Observable<Formation> {
    return this.http.get<Formation>(`${this.apiUrl}/${id}`);
  }

  createFormation(formation: Formation): Observable<Formation> {
    return this.http.post<Formation>(this.apiUrl, formation);
  }

  updateFormation(id: number, formation: Formation): Observable<Formation> {
    return this.http.put<Formation>(`${this.apiUrl}/${id}`, formation);
  }

  deleteFormation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Module endpoints
  createModule(formationId: number, module: Module): Observable<Module> {
    return this.http.post<Module>(`${this.apiUrl}/${formationId}/modules`, module);
  }

  updateModule(formationId: number, moduleId: number, module: Module): Observable<Module> {
    return this.http.put<Module>(`${this.apiUrl}/${formationId}/modules/${moduleId}`, module);
  }

  deleteModule(formationId: number, moduleId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${formationId}/modules/${moduleId}`);
  }

  // Lecon Video endpoints
  createLeconVideo(formationId: number, moduleId: number, lecon: LeconVideo): Observable<LeconVideo> {
    return this.http.post<LeconVideo>(`${this.apiUrl}/${formationId}/modules/${moduleId}/lecons`, lecon);
  }

  updateLeconVideo(formationId: number, moduleId: number, leconId: number, lecon: LeconVideo): Observable<LeconVideo> {
    return this.http.put<LeconVideo>(`${this.apiUrl}/${formationId}/modules/${moduleId}/lecons/${leconId}`, lecon);
  }

  deleteLeconVideo(formationId: number, moduleId: number, leconId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${formationId}/modules/${moduleId}/lecons/${leconId}`);
  }

  uploadLeconVideo(formationId: number, moduleId: number, file: File): Observable<{ videoUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ videoUrl: string }>(`${this.apiUrl}/${formationId}/modules/${moduleId}/lecons/upload`, formData);
  }

  createLeconCommentaire(formationId: number, moduleId: number, leconId: number, commentaire: LeconCommentaire): Observable<LeconCommentaire> {
    return this.http.post<LeconCommentaire>(`${this.apiUrl}/${formationId}/modules/${moduleId}/lecons/${leconId}/commentaires`, commentaire);
  }

  // Ressource endpoints
  createRessource(formationId: number, ressource: Ressource): Observable<Ressource> {
    return this.http.post<Ressource>(`${this.apiUrl}/${formationId}/ressources`, ressource);
  }

  createModuleRessource(formationId: number, moduleId: number, ressource: Ressource): Observable<Ressource> {
    return this.http.post<Ressource>(`${this.apiUrl}/${formationId}/modules/${moduleId}/ressources`, ressource);
  }

  uploadModuleRessource(formationId: number, moduleId: number, file: File): Observable<{ resourceUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ resourceUrl: string }>(`${this.apiUrl}/${formationId}/modules/${moduleId}/ressources/upload`, formData);
  }

  updateRessource(formationId: number, ressourceId: number, ressource: Ressource): Observable<Ressource> {
    return this.http.put<Ressource>(`${this.apiUrl}/${formationId}/ressources/${ressourceId}`, ressource);
  }

  updateModuleRessource(formationId: number, moduleId: number, ressourceId: number, ressource: Ressource): Observable<Ressource> {
    return this.http.put<Ressource>(`${this.apiUrl}/${formationId}/modules/${moduleId}/ressources/${ressourceId}`, ressource);
  }

  deleteRessource(formationId: number, ressourceId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${formationId}/ressources/${ressourceId}`);
  }

  deleteModuleRessource(formationId: number, moduleId: number, ressourceId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${formationId}/modules/${moduleId}/ressources/${ressourceId}`);
  }

  // Inscription endpoints
  inscribeToFormation(formationId: number, userId: number): Observable<InscriptionFormation> {
    return this.http.post<InscriptionFormation>(`${this.apiUrl}/${formationId}/inscriptions`, { userId });
  }

  getUserInscriptions(userId: number): Observable<InscriptionFormation[]> {
    return this.http.get<InscriptionFormation[]>(`${this.apiUrl}/user/${userId}/inscriptions`);
  }

  // Image upload endpoint
  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${this.apiUrl}/upload`, formData);
  }
}
