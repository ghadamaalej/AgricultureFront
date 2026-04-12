import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FormationService, Formation } from '../../services/formation/formation.service';
import { AuthService } from '../../services/auth/auth.service';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-formation-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SharedModule],
  templateUrl: './formation-list.component.html',
  styleUrl: './formation-list.component.css'
})
export class FormationListComponent implements OnInit {
  formations: Formation[] = [];
  filteredFormations: Formation[] = [];
  isLoading = true;
  error: string | null = null;
  isExpertAgricole = false;
  isAccountApproved = false;
  searchQuery = '';
  filterNiveau = '';
  filterType = '';
  currentUserId: number | null = null;
  userInscriptions: Set<number> = new Set();
  
  niveaux = ['DEBUTANT', 'INTERMEDIAIRE', 'AVANCE', 'EXPERT'];
  types = ['THEORIQUE', 'PRATIQUE', 'HYBRIDE'];

  constructor(
    private formationService: FormationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkUserPermissions();
    this.loadFormations();
    if (this.currentUserId) {
      this.loadUserInscriptions();
    }
  }

  checkUserPermissions(): void {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user?.userId ?? null;
    this.isExpertAgricole = this.authService.hasRole('EXPERT_AGRICOLE');
    this.isAccountApproved = this.authService.isAccountApproved();
    
    // Log permissions
    console.log('🔐 Formation List - Permission Check:');
    console.log('  👤 User ID:', this.currentUserId);
    console.log('  🎓 Is Expert Agricole:', this.isExpertAgricole);
    console.log('  ✅ Is Account Approved:', this.isAccountApproved);
    console.log('  📊 Account Status:', this.authService.getAccountStatus());
    console.log('  ⚙️ Can Manage Formations:', this.canManageFormations());
  }

  loadFormations(): void {
    this.formationService.getAllFormations().subscribe({
      next: (data) => {
        // Filter formations based on user role
        if (this.canManageFormations()) {
          // Experts can only see their own formations
          data = data.filter(f => f.userId === this.currentUserId);
        }

        this.formations = data;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading formations:', err);
        this.error = 'Impossible de charger les formations';
        this.isLoading = false;
      }
    });
  }

  loadUserInscriptions(): void {
    if (this.currentUserId) {
      this.formationService.getUserInscriptions(this.currentUserId).subscribe({
        next: (inscriptions) => {
          this.userInscriptions = new Set(inscriptions.map(i => i.idInscription || 0));
        },
        error: (err) => console.error('Error loading inscriptions:', err)
      });
    }
  }

  applyFilters(): void {
    this.filteredFormations = this.formations.filter(formation => {
      const matchesSearch = formation.titre.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                           formation.description.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                           formation.thematique.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesNiveau = !this.filterNiveau || formation.niveau === this.filterNiveau;
      const matchesType = !this.filterType || formation.type === this.filterType;
      return matchesSearch && matchesNiveau && matchesType;
    });
  }

  onSearch(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  canManageFormations(): boolean {
    return this.isExpertAgricole && this.isAccountApproved;
  }

  addFormation(): void {
    if (this.canManageFormations()) {
      this.router.navigate(['/training/add']);
    }
  }

  editFormation(id: number): void {
    if (this.canManageFormations()) {
      this.router.navigate([`/training/${id}/edit`]);
    }
  }

  deleteFormation(id: number): void {
    if (this.canManageFormations() && confirm('Êtes-vous sûr de vouloir supprimer cette formation ?')) {
      this.formationService.deleteFormation(id).subscribe({
        next: () => {
          this.formations = this.formations.filter(f => f.idFormation !== id);
          this.applyFilters();
        },
        error: (err) => console.error('Error deleting formation:', err)
      });
    }
  }

  viewFormation(id: number): void {
    this.router.navigate([`/training/${id}`]);
  }

  inscribeFormation(formation: Formation): void {
    if (!this.currentUserId) {
      this.router.navigate(['/auth']);
      return;
    }
    
    if (formation.idFormation) {
      this.formationService.inscribeToFormation(formation.idFormation, this.currentUserId).subscribe({
        next: () => {
          this.userInscriptions.add(formation.idFormation!);
          alert('Vous êtes inscrit à cette formation');
        },
        error: (err) => {
          console.error('Error subscribing:', err);
          alert('Erreur lors de l\'inscription');
        }
      });
    }
  }

  isAlreadyInscribed(id: number | undefined): boolean {
    return id ? this.userInscriptions.has(id) : false;
  }

  getFormationImage(imageUrl?: string): string {
    return imageUrl || 'assets/images/formation-default.jpg';
  }
}
