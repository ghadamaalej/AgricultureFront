import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CommandeItemRequest {
  productId: number;
  vetId: number;
  nomProduit: string;
  vetNom: string;
  vetRegion: string;
  prixUnitaire: number;
  quantite: number;
}

export interface CommandeRequest {
  agriculteurId: number;
  items: CommandeItemRequest[];
}

export interface CommandeItemResponse {
  productId: number;
  vetId: number;
  nomProduit: string;
  vetNom: string;
  vetRegion: string;
  prixUnitaire: number;
  quantite: number;
  sousTotal: number;
}

export interface CommandeResponse {
  id: number;
  agriculteurId: number;
  montantTotal: number;
  dateCommande: string;
  statut: 'EN_ATTENTE' | 'PAYE' | 'ECHEC' | 'REMBOURSE';
  stripeClientSecret: string;
  items: CommandeItemResponse[];
}

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private base = 'http://localhost:8088/inventaires/api/commandes';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  creerCommande(request: CommandeRequest): Observable<CommandeResponse> {
    return this.http.post<CommandeResponse>(this.base, request, { headers: this.headers() });
  }

  getMesCommandes(agriculteurId: number): Observable<CommandeResponse[]> {
    return this.http.get<CommandeResponse[]>(
      `${this.base}/agriculteur/${agriculteurId}`,
      { headers: this.headers() }
    );
  }

  getCommande(id: number): Observable<CommandeResponse> {
    return this.http.get<CommandeResponse>(`${this.base}/${id}`, { headers: this.headers() });
  }

  confirmerPaiementCommande(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/${id}/confirmer-paiement`,
      {},
      { headers: this.headers() }
    );
  }
}
