import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, KeyValue } from '@angular/common';

interface User {
  id?: number;
  nom?: string;
  prenom?: string;
  photo?: string;
  email?: string;
  motDePasse?: string;
  telephone?: string;
  dateCreation?: string;
  statutCompte?: 'EN_ATTENTE' | 'APPROUVE' | 'REFUSE' | 'SUSPENDU';
  motifRefus?: string;
  role?: string;
  isOnline?: boolean;
  lastSeen?: string;
  region?: string;
  diplomeExpert?: string;
  typeVehicule?: string;
  capaciteKg?: number;
  numeroPlaque?: string;
  agence?: string;
  certificatTravail?: string;
  adresseCabinet?: string;
  presentationCarriere?: string;
  telephoneCabinet?: string;
  nom_organisation?: string;
  logo_organisation?: string;
  cin?: number;
  description?: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  groupedUsers: { [role: string]: User[] } = {};
  loading = false;
  error = '';
  success = '';

  // Gateway URL
  private readonly baseUrl = 'http://localhost:8089/user/api/user';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    this.http.get<User[]>(`${this.baseUrl}/enAttente`).subscribe({
      next: (users) => {
        this.users = users || [];
        this.groupByRole();
        this.loading = false;
      },
      error: (err) => {
        console.error('loadUsers error', err);
        this.error = 'Échec de chargement des utilisateurs en attente.';
        this.loading = false;
      }
    });
  }

  groupByRole(): void {
    this.groupedUsers = {};

    this.users.forEach((user) => {
      const role = user.role || 'SANS_ROLE';

      if (!this.groupedUsers[role]) {
        this.groupedUsers[role] = [];
      }

      this.groupedUsers[role].push(user);
    });
  }

  updateStatut(user: User, statut: 'APPROUVE' | 'REFUSE'): void {
    if (!user.id) {
      this.error = 'Identifiant utilisateur manquant.';
      return;
    }

    this.error = '';
    this.success = '';

    this.http.put<User>(
      `${this.baseUrl}/updateStatut/${user.id}?statut=${statut}`,
      {}
    ).subscribe({
      next: (updatedUser) => {
        this.success = `Le statut de ${user.prenom || ''} ${user.nom || ''} a été mis à jour.`;

        // Remove approved/refused user from EN_ATTENTE list
        this.users = this.users.filter(u => u.id !== user.id);
        this.groupByRole();
      },
      error: (err) => {
        console.error('updateStatut error', err);
        this.error = 'Échec lors de la mise à jour du statut.';
      }
    });
  }

  approuver(user: User): void {
    this.updateStatut(user, 'APPROUVE');
  }

  refuser(user: User): void {
    this.updateStatut(user, 'REFUSE');
  }

  getRoleKeys(): string[] {
    return Object.keys(this.groupedUsers);
  }

  formatRole(role: string): string {
    return role.replace(/_/g, ' ');
  }

  getRoleIcon(role: string): string {
    const iconMap: { [key: string]: string } = {
      'FARMER': 'fas fa-leaf',
      'TRANSPORT': 'fas fa-truck',
      'EXPERT': 'fas fa-certificate',
      'CONSULTANT': 'fas fa-briefcase',
      'ORGANISATION': 'fas fa-building',
      'BUYER': 'fas fa-shopping-cart',
      'SELLER': 'fas fa-store',
      'ADMIN': 'fas fa-cog',
      'SANS_ROLE': 'fas fa-question-circle'
    };
    return iconMap[role] || 'fas fa-user';
  }
}