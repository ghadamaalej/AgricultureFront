import { Component, Input, OnInit } from '@angular/core';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  AvisResponse,
  VetRatingSummary,
  CreateAvisRequest,
  CommentaireAvisResponse
} from '../../models/appointments.models';

@Component({
  selector: 'app-farmer-avis',
  standalone: false,
  templateUrl: './farmer-avis.component.html',
  styleUrls: ['./farmer-avis.component.css']
})
export class FarmerAvisComponent implements OnInit {
  @Input() vetId!: number;

  // Data
  avis: AvisResponse[] = [];
  summary: VetRatingSummary | null = null;
  loading = true;
  error = '';

  // Current user
  currentUserId!: number;
  currentUserRole = '';
  hasAlreadyReviewed = false;

  // Formulaire nouvel avis
  showAvisForm = false;
  newNote = 0;
  hoverNote = 0;
  newCommentaire = '';
  submittingAvis = false;
  avisError = '';

  // Commentaires (réponses d'agriculteurs)
  commentInputs: { [avisId: number]: string } = {};
  showCommentInput: { [avisId: number]: boolean } = {};
  submittingComment: { [avisId: number]: boolean } = {};

  // Likes
  likingId: number | null = null;

  constructor(
    private api: AppointmentsApiService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.currentUserId = this.auth.getCurrentUserId()!;
    this.currentUserRole = this.auth.getCurrentRole() || '';
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';

    this.api.getVetRatingSummary(this.vetId).subscribe({
      next: s => { this.summary = s; },
      error: () => {}
    });

    this.api.getAvisByVet(this.vetId).subscribe({
      next: list => {
        this.avis = list;
        this.hasAlreadyReviewed = list.some(a => a.agriculteurId === this.currentUserId);
        this.loading = false;
      },
      error: e => {
        this.loading = false;
        this.error = e.error?.message || 'Erreur lors du chargement des avis';
      }
    });
  }

  // ── Étoiles ─────────────────────────────────────────────
  setHover(n: number)  { this.hoverNote = n; }
  clearHover()         { this.hoverNote = 0; }
  setNote(n: number)   { this.newNote = n; }
  starClass(n: number, hovered: number, selected: number): string {
    return (n <= (hovered || selected)) ? 'star filled' : 'star';
  }

  starsArray(note: number): boolean[] {
    return [1, 2, 3, 4, 5].map(i => i <= Math.round(note));
  }

  noteLabel(n: number): string {
    return ['', 'Mauvais', 'Insuffisant', 'Bien', 'Très bien', 'Excellent'][n] || '';
  }

  distributionWidth(star: number): number {
    if (!this.summary || this.summary.totalAvis === 0) return 0;
    const count = this.summary.distribution?.[star] || 0;
    return Math.round((count / this.summary.totalAvis) * 100);
  }

  distributionCount(star: number): number {
    return this.summary?.distribution?.[star] || 0;
  }

  // ── Créer un avis ────────────────────────────────────────
  openAvisForm()  { this.showAvisForm = true; this.avisError = ''; }
  cancelAvisForm() {
    this.showAvisForm = false;
    this.newNote = 0;
    this.newCommentaire = '';
    this.avisError = '';
  }

  submitAvis() {
    if (this.newNote === 0) { this.avisError = 'Veuillez sélectionner une note.'; return; }
    if (!this.newCommentaire.trim()) { this.avisError = 'Veuillez écrire un commentaire.'; return; }

    this.submittingAvis = true;
    this.avisError = '';

    const req: CreateAvisRequest = {
      note: this.newNote,
      commentaire: this.newCommentaire.trim(),
      veterinarianId: this.vetId
    };

    this.api.createAvis(req).subscribe({
      next: newAvis => {
        this.avis.unshift(newAvis);
        this.hasAlreadyReviewed = true;
        this.submittingAvis = false;
        this.cancelAvisForm();
        this.load();
      },
      error: e => {
        this.submittingAvis = false;
        this.avisError = e.error?.message || 'Erreur lors de l\'envoi de votre avis';
      }
    });
  }

  // ── Like ─────────────────────────────────────────────────
  toggleLike(a: AvisResponse) {
    if (a.agriculteurId === this.currentUserId) return; // ne peut pas liker son propre avis
    this.likingId = a.id;
    this.api.toggleLike(a.id).subscribe({
      next: () => {
        if (a.likedByMe) {
          a.likedByMe = false;
          a.nbLikes--;
        } else {
          a.likedByMe = true;
          a.nbLikes++;
        }
        this.likingId = null;
      },
      error: () => { this.likingId = null; }
    });
  }

  // ── Commentaire d'agriculteur ────────────────────────────
  toggleCommentInput(avisId: number) {
    this.showCommentInput[avisId] = !this.showCommentInput[avisId];
    if (!this.commentInputs[avisId]) this.commentInputs[avisId] = '';
  }

  submitCommentaire(a: AvisResponse) {
    const contenu = (this.commentInputs[a.id] || '').trim();
    if (!contenu) return;

    this.submittingComment[a.id] = true;
    this.api.addCommentaire(a.id, contenu).subscribe({
      next: c => {
        a.commentaires.push(c);
        this.commentInputs[a.id] = '';
        this.showCommentInput[a.id] = false;
        this.submittingComment[a.id] = false;
      },
      error: e => {
        this.submittingComment[a.id] = false;
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  initials(nom: string, prenom: string): string {
    return ((prenom?.charAt(0) || '') + (nom?.charAt(0) || '')).toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  get isAgriculteur(): boolean {
    return this.currentUserRole === 'AGRICULTEUR';
  }

  get averageDisplay(): string {
    if (!this.summary || this.summary.totalAvis === 0) return '—';
    return this.summary.moyenneNote.toFixed(1);
  }

  stars5 = [1, 2, 3, 4, 5];
}
