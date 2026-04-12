import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FormationService, Formation, Module, LeconVideo, Ressource } from '../../services/formation/formation.service';
import { AuthService } from '../../services/auth/auth.service';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-formation-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SharedModule],
  templateUrl: './formation-detail.component.html',
  styleUrl: './formation-detail.component.css'
})
export class FormationDetailComponent implements OnInit {
  formation: Formation | null = null;
  isLoading = true;
  error: string | null = null;
  isExpertAgricole = false;
  isAccountApproved = false;
  currentUserId: number | null = null;
  isInscribed = false;
  activeTab: 'overview' | 'modules' | 'resources' = 'overview';
  
  // Form states
  showModuleForm = false;
  showLeconForm = false;
  showRessourceForm = false;
  editingModuleId: number | null = null;
  editingLeconId: number | null = null;
  editingRessourceId: number | null = null;

  // Form data
  newModule: Module = { titre: '', ordre: 0 };
  newLecon: LeconVideo = { titre: '', urlVideo: '', dureeSecondes: 0, ordre: 0 };
  newRessource: Ressource = { titre: '', type: 'PDF', url: '' };

  resourceTypes = ['PDF', 'VIDEO', 'LIEN', 'DOCUMENT', 'IMAGE'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.checkUserPermissions();
    this.loadFormation();
  }

  checkUserPermissions(): void {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user?.userId ?? null;
    this.isExpertAgricole = this.authService.hasRole('EXPERT_AGRICOLE');
    this.isAccountApproved = this.authService.isAccountApproved();
    
    // Log permissions
    console.log('🔐 Formation Detail - Permission Check:');
    console.log('  👤 User ID:', this.currentUserId);
    console.log('  🎓 Is Expert Agricole:', this.isExpertAgricole);
    console.log('  ✅ Is Account Approved:', this.isAccountApproved);
    console.log('  📊 Account Status:', this.authService.getAccountStatus());
  }

  loadFormation(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.formationService.getFormationById(Number(id)).subscribe({
        next: (data) => {
          this.formation = data;
          
          // Try to load image from localStorage first
          const imageKey = `formation_image_${data.idFormation}`;
          const storedImage = localStorage.getItem(imageKey);
          if (storedImage) {
            this.formation.imageUrl = storedImage;
            console.log('📸 Image loaded from localStorage for formation detail:', data.idFormation);
          }
          
          this.checkIfInscribed();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading formation:', err);
          this.error = 'Impossible de charger la formation';
          this.isLoading = false;
        }
      });
    }
  }

  checkIfInscribed(): void {
    if (this.currentUserId && this.formation?.inscriptions) {
      this.isInscribed = this.formation.inscriptions.some(i => i.userId === this.currentUserId);
    }
  }

  canManage(): boolean {
    return this.isExpertAgricole && this.isAccountApproved;
  }

  // Module Management
  toggleModuleForm(): void {
    this.showModuleForm = !this.showModuleForm;
    if (!this.showModuleForm) {
      this.resetModuleForm();
    }
  }

  resetModuleForm(): void {
    this.newModule = { titre: '', ordre: 0 };
    this.editingModuleId = null;
  }

  saveModule(): void {
    if (!this.formation?.idFormation || !this.newModule.titre) return;

    if (this.editingModuleId) {
      this.formationService.updateModule(this.formation.idFormation, this.editingModuleId, this.newModule).subscribe({
        next: () => {
          this.loadFormation();
          this.toggleModuleForm();
        },
        error: (err) => console.error('Error updating module:', err)
      });
    } else {
      this.formationService.createModule(this.formation.idFormation, this.newModule).subscribe({
        next: () => {
          this.loadFormation();
          this.toggleModuleForm();
        },
        error: (err) => console.error('Error creating module:', err)
      });
    }
  }

  editModule(module: Module): void {
    this.newModule = { ...module };
    this.editingModuleId = module.idModule || null;
    this.showModuleForm = true;
  }

  deleteModule(moduleId: number | undefined): void {
    if (!this.formation?.idFormation || !moduleId || !confirm('Supprimer ce module ?')) return;

    this.formationService.deleteModule(this.formation.idFormation, moduleId).subscribe({
      next: () => {
        this.loadFormation();
      },
      error: (err) => console.error('Error deleting module:', err)
    });
  }

  // Lecon Management
  toggleLeconForm(): void {
    this.showLeconForm = !this.showLeconForm;
    if (!this.showLeconForm) {
      this.resetLeconForm();
    }
  }

  resetLeconForm(): void {
    this.newLecon = { titre: '', urlVideo: '', dureeSecondes: 0, ordre: 0 };
    this.editingLeconId = null;
  }

  saveLecon(module: Module): void {
    if (!this.formation?.idFormation || !module.idModule || !this.newLecon.titre) return;

    if (this.editingLeconId) {
      this.formationService.updateLeconVideo(this.formation.idFormation, module.idModule, this.editingLeconId, this.newLecon).subscribe({
        next: () => {
          this.loadFormation();
          this.toggleLeconForm();
        },
        error: (err) => console.error('Error updating lecon:', err)
      });
    } else {
      this.formationService.createLeconVideo(this.formation.idFormation, module.idModule, this.newLecon).subscribe({
        next: () => {
          this.loadFormation();
          this.toggleLeconForm();
        },
        error: (err) => console.error('Error creating lecon:', err)
      });
    }
  }

  editLecon(lecon: LeconVideo): void {
    this.newLecon = { ...lecon };
    this.editingLeconId = lecon.idLecon || null;
    this.showLeconForm = true;
  }

  deleteLecon(module: Module, leconId: number | undefined): void {
    if (!this.formation?.idFormation || !module.idModule || !leconId || !confirm('Supprimer cette leçon ?')) return;

    this.formationService.deleteLeconVideo(this.formation.idFormation, module.idModule, leconId).subscribe({
      next: () => {
        this.loadFormation();
      },
      error: (err) => console.error('Error deleting lecon:', err)
    });
  }

  // Ressource Management
  toggleRessourceForm(): void {
    this.showRessourceForm = !this.showRessourceForm;
    if (!this.showRessourceForm) {
      this.resetRessourceForm();
    }
  }

  resetRessourceForm(): void {
    this.newRessource = { titre: '', type: 'PDF', url: '' };
    this.editingRessourceId = null;
  }

  saveRessource(): void {
    if (!this.formation?.idFormation || !this.newRessource.titre) return;

    if (this.editingRessourceId) {
      this.formationService.updateRessource(this.formation.idFormation, this.editingRessourceId, this.newRessource).subscribe({
        next: () => {
          this.loadFormation();
          this.toggleRessourceForm();
        },
        error: (err) => console.error('Error updating ressource:', err)
      });
    } else {
      this.formationService.createRessource(this.formation.idFormation, this.newRessource).subscribe({
        next: () => {
          this.loadFormation();
          this.toggleRessourceForm();
        },
        error: (err) => console.error('Error creating ressource:', err)
      });
    }
  }

  editRessource(ressource: Ressource): void {
    this.newRessource = { ...ressource };
    this.editingRessourceId = ressource.idRessource || null;
    this.showRessourceForm = true;
  }

  deleteRessource(ressourceId: number | undefined): void {
    if (!this.formation?.idFormation || !ressourceId || !confirm('Supprimer cette ressource ?')) return;

    this.formationService.deleteRessource(this.formation.idFormation, ressourceId).subscribe({
      next: () => {
        this.loadFormation();
      },
      error: (err) => console.error('Error deleting ressource:', err)
    });
  }

  // User Actions
  inscribeFormation(): void {
    if (!this.currentUserId || !this.formation?.idFormation) {
      this.router.navigate(['/auth']);
      return;
    }

    this.formationService.inscribeToFormation(this.formation.idFormation, this.currentUserId).subscribe({
      next: () => {
        this.isInscribed = true;
        alert('Vous êtes maintenant inscrit à cette formation');
      },
      error: (err) => {
        console.error('Error subscribing:', err);
        alert('Erreur lors de l\'inscription');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/training']);
  }

  getDurationDisplay(seconds: number | undefined): string {
    if (!seconds) return '0m';
    const minutes = Math.floor((seconds || 0) / 60);
    const secs = (seconds || 0) % 60;
    return `${minutes}m ${secs}s`;
  }
}
