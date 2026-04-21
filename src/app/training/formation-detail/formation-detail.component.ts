import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  activeLeconModuleId: number | null = null;
  activeRessourceModuleId: number | null = null;
  isUploadingVideo = false;
  isUploadingRessource = false;
  activeLiveLeconId: number | null = null;
  leconMode: 'recorded' | 'stream' = 'recorded';
  commentDrafts: Record<number, string> = {};

  // Form data
  newModule: Module = { titre: '', ordre: 0 };
  newLecon: LeconVideo = { titre: '', urlVideo: '', dureeSecondes: 0, ordre: 0, liveAt: '', streamingRoom: '' };
  newRessource: Ressource = { titre: '', type: 'PDF', url: '' };

  resourceTypes = ['PDF', 'DOC', 'LIEN', 'IMAGE'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private authService: AuthService,
    private sanitizer: DomSanitizer
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
  toggleLeconForm(moduleId?: number): void {
    if (moduleId && this.activeLeconModuleId !== moduleId) {
      this.activeLeconModuleId = moduleId;
      this.showLeconForm = true;
      this.resetLeconForm(false);
      return;
    }

    this.showLeconForm = !this.showLeconForm;
    this.activeLeconModuleId = this.showLeconForm ? moduleId ?? this.activeLeconModuleId : null;
    if (!this.showLeconForm) {
      this.resetLeconForm();
    }
  }

  resetLeconForm(clearModule = true): void {
    this.newLecon = { titre: '', urlVideo: '', dureeSecondes: 0, ordre: 0, liveAt: '', streamingRoom: '' };
    this.editingLeconId = null;
    this.leconMode = 'recorded';
    if (clearModule) {
      this.activeLeconModuleId = null;
    }
  }

  saveLecon(module: Module): void {
    if (!this.formation?.idFormation || !module.idModule || !this.newLecon.titre) return;
    this.normalizeLeconByMode();
    this.ensureStreamingRoom();

    if (this.editingLeconId) {
      this.formationService.updateLeconVideo(this.formation.idFormation, module.idModule, this.editingLeconId, this.newLecon).subscribe({
        next: () => {
          this.loadFormation();
          this.showLeconForm = false;
          this.resetLeconForm();
        },
        error: (err) => console.error('Error updating lecon:', err)
      });
    } else {
      this.formationService.createLeconVideo(this.formation.idFormation, module.idModule, this.newLecon).subscribe({
        next: () => {
          this.loadFormation();
          this.showLeconForm = false;
          this.resetLeconForm();
        },
        error: (err) => console.error('Error creating lecon:', err)
      });
    }
  }

  editLecon(module: Module, lecon: LeconVideo): void {
    this.newLecon = { ...lecon };
    this.editingLeconId = lecon.idLecon || null;
    this.activeLeconModuleId = module.idModule || null;
    this.leconMode = lecon.liveAt || lecon.streamingRoom ? 'stream' : 'recorded';
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
  toggleRessourceForm(moduleId?: number): void {
    if (moduleId && this.activeRessourceModuleId !== moduleId) {
      this.activeRessourceModuleId = moduleId;
      this.showRessourceForm = true;
      this.resetRessourceForm(false);
      return;
    }

    this.showRessourceForm = !this.showRessourceForm;
    this.activeRessourceModuleId = this.showRessourceForm ? moduleId ?? this.activeRessourceModuleId : null;
    if (!this.showRessourceForm) {
      this.resetRessourceForm();
    }
  }

  resetRessourceForm(clearModule = true): void {
    this.newRessource = { titre: '', type: 'PDF', url: '' };
    this.editingRessourceId = null;
    if (clearModule) {
      this.activeRessourceModuleId = null;
    }
  }

  saveRessource(module?: Module): void {
    if (!this.formation?.idFormation || !this.newRessource.titre) return;

    if (module?.idModule && this.editingRessourceId) {
      this.formationService.updateModuleRessource(this.formation.idFormation, module.idModule, this.editingRessourceId, this.newRessource).subscribe({
        next: () => {
          this.loadFormation();
          this.showRessourceForm = false;
          this.resetRessourceForm();
        },
        error: (err) => console.error('Error updating module ressource:', err)
      });
    } else if (module?.idModule) {
      this.formationService.createModuleRessource(this.formation.idFormation, module.idModule, this.newRessource).subscribe({
        next: () => {
          this.loadFormation();
          this.showRessourceForm = false;
          this.resetRessourceForm();
        },
        error: (err) => console.error('Error creating module ressource:', err)
      });
    } else if (this.editingRessourceId) {
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

  editRessource(ressource: Ressource, module?: Module): void {
    this.newRessource = { ...ressource };
    this.editingRessourceId = ressource.idRessource || null;
    this.activeRessourceModuleId = module?.idModule || null;
    this.showRessourceForm = true;
  }

  deleteRessource(ressourceId: number | undefined, module?: Module): void {
    if (!this.formation?.idFormation || !ressourceId || !confirm('Supprimer cette ressource ?')) return;

    const request = module?.idModule
      ? this.formationService.deleteModuleRessource(this.formation.idFormation, module.idModule, ressourceId)
      : this.formationService.deleteRessource(this.formation.idFormation, ressourceId);

    request.subscribe({
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

  getTotalLecons(): number {
    return this.formation?.modules?.reduce((total, module) => total + (module.lecons?.length || 0), 0) || 0;
  }

  getTotalModuleRessources(): number {
    return this.formation?.modules?.reduce((total, module) => total + (module.ressources?.length || 0), 0) || 0;
  }

  getModulesSorted(): Module[] {
    return [...(this.formation?.modules || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }

  getLeconsSorted(module: Module): LeconVideo[] {
    return [...(module.lecons || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }

  getModuleRessourcesSorted(module: Module): Ressource[] {
    return [...(module.ressources || [])].sort((a, b) => (a.titre || '').localeCompare(b.titre || ''));
  }

  onVideoSelected(event: Event, module: Module): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.formation?.idFormation || !module.idModule) return;

    this.isUploadingVideo = true;
    this.formationService.uploadLeconVideo(this.formation.idFormation, module.idModule, file).subscribe({
      next: ({ videoUrl }) => {
        this.newLecon.urlVideo = videoUrl;
        this.isUploadingVideo = false;
        input.value = '';
      },
      error: (err) => {
        console.error('Error uploading video:', err);
        this.isUploadingVideo = false;
        alert('Erreur lors de l upload vidéo');
      }
    });
  }

  onRessourceSelected(event: Event, module: Module): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.formation?.idFormation || !module.idModule) return;

    this.isUploadingRessource = true;
    this.newRessource.type = 'PDF';
    this.formationService.uploadModuleRessource(this.formation.idFormation, module.idModule, file).subscribe({
      next: ({ resourceUrl }) => {
        this.newRessource.url = resourceUrl;
        if (!this.newRessource.titre) {
          this.newRessource.titre = file.name.replace(/\.[^/.]+$/, '');
        }
        this.isUploadingRessource = false;
        input.value = '';
      },
      error: (err) => {
        console.error('Error uploading resource:', err);
        this.isUploadingRessource = false;
        alert('Erreur lors de l upload PDF');
      }
    });
  }

  toggleLive(lecon: LeconVideo): void {
    if (!lecon.idLecon) return;
    this.activeLiveLeconId = this.activeLiveLeconId === lecon.idLecon ? null : lecon.idLecon;
  }

  canJoinLive(lecon: LeconVideo): boolean {
    return !!lecon.streamingRoom;
  }

  getJitsiUrl(lecon: LeconVideo): SafeResourceUrl | null {
    if (!lecon.streamingRoom) return null;

    const user = this.authService.getCurrentUser();
    const room = encodeURIComponent(lecon.streamingRoom);
    const displayName = encodeURIComponent(user?.username || 'Participant');
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://meet.jit.si/${room}#userInfo.displayName="${displayName}"`);
  }

  addComment(module: Module, lecon: LeconVideo): void {
    if (!this.formation?.idFormation || !module.idModule || !lecon.idLecon) return;

    const contenu = (this.commentDrafts[lecon.idLecon] || '').trim();
    if (!contenu) return;

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }

    this.formationService.createLeconCommentaire(this.formation.idFormation, module.idModule, lecon.idLecon, {
      contenu,
      auteurId: user.userId,
      auteurNom: user.username
    }).subscribe({
      next: () => {
        this.commentDrafts[lecon.idLecon!] = '';
        this.loadFormation();
      },
      error: (err) => console.error('Error creating comment:', err)
    });
  }

  private ensureStreamingRoom(): void {
    if (!this.formation?.idFormation || !this.newLecon.liveAt || this.newLecon.streamingRoom) return;

    const title = this.newLecon.titre || 'lecon';
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    this.newLecon.streamingRoom = `agrezen-formation-${this.formation.idFormation}-${slug || Date.now()}`;
  }

  private normalizeLeconByMode(): void {
    if (this.leconMode === 'recorded') {
      this.newLecon.liveAt = '';
      this.newLecon.streamingRoom = '';
      return;
    }

    this.newLecon.urlVideo = '';
    this.newLecon.dureeSecondes = 0;
  }

  isYoutubeUrl(url: string | undefined): boolean {
    if (!url) return false;
    return /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)/i.test(url);
  }

  isDirectVideoUrl(url: string | undefined): boolean {
    if (!url) return false;
    return !this.isYoutubeUrl(url);
  }

  getYoutubeEmbedUrl(url: string | undefined): SafeResourceUrl | null {
    if (!url) return null;

    const videoId = this.extractYoutubeVideoId(url);
    if (!videoId) return null;

    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
  }

  private extractYoutubeVideoId(url: string): string | null {
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/i,
      /youtube\.com\/embed\/([^?&]+)/i,
      /youtu\.be\/([^?&]+)/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }
}
