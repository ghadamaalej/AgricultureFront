import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormationService, Formation } from '../../services/formation/formation.service';
import { AuthService } from '../../services/auth/auth.service';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-formation-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: './formation-form.component.html',
  styleUrl: './formation-form.component.css'
})
export class FormationFormComponent implements OnInit {
  private readonly maxOriginalImageBytes = 8 * 1024 * 1024;
  private readonly maxUploadImageBytes = 1200 * 1024;
  private readonly maxImageDimension = 1400;

  formation: Formation = {
    titre: '',
    description: '',
    thematique: '',
    niveau: 'DEBUTANT',
    type: 'PRESENTIEL',
    prix: 0,
    estPayante: false,
    langue: 'FR',
    imageUrl: '',
    statut: 'BROUILLON'
  };

  isLoading = false;
  isSubmitting = false;
  error: string | null = null;
  success: string | null = null;
  isEditMode = false;
  currentUserId: number | null = null;
  isExpertAgricole = false;
  isAccountApproved = false;

  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  niveaux = ['DEBUTANT', 'INTERMEDIAIRE', 'AVANCE'];
  types = ['PRESENTIEL', 'EN_LIGNE', 'HYBRIDE'];
  langues = ['FR', 'EN', 'ES', 'DE', 'IT'];
  statuts = ['BROUILLON', 'PUBLIEE', 'ARCHIVEE'];

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
    console.log('🔐 Formation Form - Permission Check:');
    console.log('  👤 User ID:', this.currentUserId);
    console.log('  🎓 Is Expert Agricole:', this.isExpertAgricole);
    console.log('  ✅ Is Account Approved:', this.isAccountApproved);
    console.log('  📊 Account Status:', this.authService.getAccountStatus());

    // If not logged in, redirect immediately
    if (!this.currentUserId) {
      console.log('❌ Redirecting: Not logged in');
      this.router.navigate(['/auth']);
      return;
    }

    // If not EXPERT_AGRICOLE, redirect immediately
    if (!this.isExpertAgricole) {
      console.log('❌ Redirecting: Not EXPERT_AGRICOLE');
      this.router.navigate(['/training']);
      return;
    }

    // If account not approved, redirect
    if (!this.isAccountApproved) {
      console.log('❌ Redirecting: Account not approved');
      this.router.navigate(['/training']);
      return;
    }

    console.log('✅ Access granted: EXPERT_AGRICOLE with approved account');
  }

  loadFormation(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isLoading = true;
      this.isEditMode = true;
      this.formationService.getFormationById(Number(id)).subscribe({
        next: (data) => {
          this.formation = data;
          
          if (this.formation.imageUrl) {
            this.imagePreview = this.formation.imageUrl;
          }
          
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

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;
    this.error = null;
    this.success = null;

    // If there's an image to upload, do it first
    if (this.selectedImageFile) {
      this.uploadImageAndSubmit();
    } else {
      this.submitFormation();
    }
  }

  private uploadImageAndSubmit(): void {
    if (!this.selectedImageFile) {
      this.submitFormation();
      return;
    }

    this.formationService.uploadImage(this.selectedImageFile).subscribe({
      next: (response) => {
        this.formation.imageUrl = response.imageUrl;
        this.submitFormation();
      },
      error: (err) => {
        console.error('Error uploading image:', err);
        this.error = 'Erreur lors du téléchargement de l\'image';
        this.isSubmitting = false;
      }
    });
  }

  private submitFormation(): void {
    if (this.isEditMode && this.formation.idFormation) {
      this.formationService.updateFormation(this.formation.idFormation, this.formation).subscribe({
        next: () => {
          this.success = 'Formation mise à jour avec succès';
          setTimeout(() => this.router.navigate(['/training', this.formation.idFormation]), 1500);
        },
        error: (err) => {
          console.error('Error updating formation:', err);
          this.error = 'Erreur lors de la mise à jour de la formation';
          this.isSubmitting = false;
        }
      });
    } else {
      // Set userId for new formations
      const formationData = { ...this.formation };
      formationData.userId = this.currentUserId ?? undefined;
      delete formationData.idFormation; // Don't send id for new formations
      
      console.log('📤 Sending formation data:', formationData);
      
      this.formationService.createFormation(formationData).subscribe({
        next: (data) => {
          console.log('✅ Formation created successfully:', data);
          
          this.success = 'Formation créée avec succès';
          setTimeout(() => this.router.navigate(['/training', data.idFormation]), 1500);
        },
        error: (err) => {
          console.error('❌ Error creating formation:', err);
          console.error('❌ Error details:', err.error);
          this.error = 'Erreur lors de la création de la formation';
          this.isSubmitting = false;
        }
      });
    }
  }

  validateForm(): boolean {
    if (!this.formation.titre?.trim()) {
      this.error = 'Le titre est obligatoire';
      return false;
    }
    if (!this.formation.description?.trim()) {
      this.error = 'La description est obligatoire';
      return false;
    }
    if (!this.formation.thematique?.trim()) {
      this.error = 'La thématique est obligatoire';
      return false;
    }
    if (this.formation.estPayante && !this.formation.prix) {
      this.error = 'Le prix est obligatoire pour une formation payante';
      return false;
    }
    return true;
  }

  async onFileSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.error = 'Veuillez sélectionner un fichier image valide';
        event.target.value = '';
        return;
      }

      // Validate file size before compression.
      if (file.size > this.maxOriginalImageBytes) {
        this.error = 'La taille de l\'image ne doit pas dépasser 5MB';
        return;
      }

      const optimizedFile = await this.optimizeImageForUpload(file).catch((err) => {
        console.error('Error optimizing image:', err);
        this.error = 'Impossible de preparer cette image';
        event.target.value = '';
        return null;
      });
      if (!optimizedFile) {
        return;
      }
      if (optimizedFile.size > this.maxUploadImageBytes) {
        this.error = 'Image trop lourde apres optimisation. Choisissez une image plus petite.';
        event.target.value = '';
        return;
      }

      this.selectedImageFile = optimizedFile;
      this.error = null;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
        // For now, we'll use the data URL as imageUrl
        // In production, this would be uploaded to server and get a proper URL
        this.formation.imageUrl = this.imagePreview;
      };
      reader.readAsDataURL(optimizedFile);

      console.log('📸 Image selected:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    }
  }

  private optimizeImageForUpload(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const scale = Math.min(1, this.maxImageDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const createBlob = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }

              if (blob.size > this.maxUploadImageBytes && quality > 0.52) {
                createBlob(quality - 0.12);
                return;
              }

              const optimizedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
              resolve(new File([blob], optimizedName, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            quality
          );
        };

        createBlob(0.82);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image'));
      };

      img.src = objectUrl;
    });
  }

  removeImage(): void {
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.formation.imageUrl = '';
  }

  goBack(): void {
    if (this.isEditMode && this.formation.idFormation) {
      this.router.navigate(['/training', this.formation.idFormation]);
    } else {
      this.router.navigate(['/training']);
    }
  }
}
