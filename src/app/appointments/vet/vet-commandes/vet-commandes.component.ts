import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../services/auth/auth.service';

export type StatutCommande = 'EN_ATTENTE' | 'PAYE' | 'ECHEC' | 'REMBOURSE';

export interface CommandeItemVet {
  productId: number;
  nomProduit: string;
  prixUnitaire: number;
  quantite: number;
  sousTotal: number;
}

export interface CommandeVet {
  id: number;
  montantTotal: number;
  dateCommande: string;
  statut: StatutCommande;
  agriculteurId: number;
  agriculteurNom: string;
  agriculteurPrenom: string;
  agriculteurEmail: string;
  agriculteurTelephone: string;
  agriculteurCin: string;
  items: CommandeItemVet[];
}

@Component({
  selector: 'app-vet-commandes',
  standalone: false,
  templateUrl: './vet-commandes.component.html',
  styleUrls: ['./vet-commandes.component.css']
})
export class VetCommandesComponent implements OnInit {

  commandes: CommandeVet[] = [];
  filtered: CommandeVet[] = [];
  loading = true;
  error = '';

  // Modal produits
  selectedCommande: CommandeVet | null = null;
  showModal = false;

  // Filtre statut
  filterStatut: StatutCommande | 'ALL' = 'ALL';
  statutOptions: { label: string; value: StatutCommande | 'ALL' }[] = [
    { label: 'Toutes',     value: 'ALL'       },
    { label: 'En attente', value: 'EN_ATTENTE' },
    { label: 'Payées',     value: 'PAYE'       },
    { label: 'Échouées',   value: 'ECHEC'      },
    { label: 'Remboursées',value: 'REMBOURSE'  },
  ];

  private base = 'http://localhost:8088/inventaires/api/commandes';

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit(): void {
    this.load();
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const vetId = this.auth.getCurrentUserId();
    if (!vetId) { this.error = 'Session expirée.'; this.loading = false; return; }

    this.http.get<CommandeVet[]>(`${this.base}/vet/${vetId}`, { headers: this.headers() })
      .subscribe({
        next: data => {
          this.commandes = data;
          this.applyFilter();
          this.loading = false;
        },
        error: e => {
          this.error = e.status === 0 ? 'Serveur inaccessible.' : (e.error?.message || 'Erreur de chargement.');
          this.loading = false;
        }
      });
  }

  setFilter(f: StatutCommande | 'ALL'): void {
    this.filterStatut = f;
    this.applyFilter();
  }

  applyFilter(): void {
    this.filtered = this.filterStatut === 'ALL'
      ? this.commandes
      : this.commandes.filter(c => c.statut === this.filterStatut);
  }

  count(s: StatutCommande | 'ALL'): number {
    return s === 'ALL' ? this.commandes.length
      : this.commandes.filter(c => c.statut === s).length;
  }

  openProduits(c: CommandeVet): void {
    this.selectedCommande = c;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedCommande = null;
  }

  statutLabel(s: StatutCommande): string {
    return { EN_ATTENTE: 'En attente', PAYE: 'Payée', ECHEC: 'Échouée', REMBOURSE: 'Remboursée' }[s] || s;
  }

  statutClass(s: StatutCommande): string {
    return { EN_ATTENTE: 'st-wait', PAYE: 'st-ok', ECHEC: 'st-fail', REMBOURSE: 'st-refund' }[s] || '';
  }

  trackById(_: number, c: CommandeVet): number { return c.id; }
}