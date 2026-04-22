import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AuthService } from '../../../services/auth/auth.service';
import { BadWordsService } from '../../../services/bad-words/bad-words.service';
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

  // Commentaires
  commentInputs: { [avisId: number]: string } = {};
  showCommentInput: { [avisId: number]: boolean } = {};
  submittingComment: { [avisId: number]: boolean } = {};

  // Likes
  likingId: number | null = null;

  // ── Traduction ────────────────────────────────────────────────────────────
  /** Texte traduit indexé par id d'avis */
  translations: { [avisId: number]: string } = {};
  /** Langue dans laquelle la traduction est affichée ('fr' | 'en') */
  translationLang: { [avisId: number]: 'fr' | 'en' } = {};
  /** Spinners */
  translatingId: { [avisId: number]: boolean } = {};
  /** Messages d'erreur */
  translationErrors: { [avisId: number]: string } = {};

  constructor(
    private api:  AppointmentsApiService,
    private auth: AuthService,
    public  badWords: BadWordsService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.currentUserId   = this.auth.getCurrentUserId()!;
    this.currentUserRole = this.auth.getCurrentRole() || '';
    this.load();
  }

  load() {
    this.loading = true;
    this.error   = '';

    this.api.getVetRatingSummary(this.vetId).subscribe({
      next: s  => { this.summary = s; },
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
  openAvisForm()   { this.showAvisForm = true; this.avisError = ''; }
  cancelAvisForm() {
    this.showAvisForm   = false;
    this.newNote        = 0;
    this.newCommentaire = '';
    this.avisError      = '';
  }

  submitAvis() {
    if (this.newNote === 0) {
      this.avisError = 'Veuillez sélectionner une note.'; return;
    }
    if (!this.newCommentaire.trim()) {
      this.avisError = 'Veuillez écrire un commentaire.'; return;
    }
    if (this.badWords.containsBadWord(this.newCommentaire)) {
      this.avisError = '⚠️ Votre commentaire contient des mots inappropriés. Veuillez le reformuler.'; return;
    }

    this.submittingAvis = true;
    this.avisError      = '';

    const req: CreateAvisRequest = {
      note:           this.newNote,
      commentaire:    this.newCommentaire.trim(),
      veterinarianId: this.vetId
    };

    this.api.createAvis(req).subscribe({
      next: newAvis => {
        this.avis.unshift(newAvis);
        this.hasAlreadyReviewed = true;
        this.submittingAvis     = false;
        this.cancelAvisForm();
        this.load();
      },
      error: e => {
        this.submittingAvis = false;
        this.avisError = e.error?.message || 'Erreur lors de l\'envoi de votre avis';
      }
    });
  }

  get hasInappropriateContent(): boolean {
    return this.newCommentaire.length > 2 && this.badWords.containsBadWord(this.newCommentaire);
  }

  // ── Traduction intelligente ───────────────────────────────────────────────
  /**
   * Logique :
   *  - Passe 1 : essai en|fr (anglais → français)
   *    → Si résultat différent de l'original : succès, affiche en FR
   *  - Passe 2 (fallback) : essai ar|fr (arabe → français)
   *    → Si résultat différent : succès, affiche en FR
   *  - Si les deux passes donnent un résultat IDENTIQUE à l'original :
   *    → le texte est probablement déjà en français
   *    → on traduit automatiquement fr|en (français → anglais)
   */
  translateAvis(a: AvisResponse): void {
    if (!a.commentaire?.trim()) return;
    this.translatingId[a.id]     = true;
    this.translationErrors[a.id] = '';
    delete this.translations[a.id];
    delete this.translationLang[a.id];

    this.tryTranslate(a, 'en|fr', true);
  }

  private tryTranslate(a: AvisResponse, langPair: string, allowFallback: boolean): void {
    const url = `https://api.mymemory.translated.net/get`
              + `?q=${encodeURIComponent(a.commentaire)}&langpair=${langPair}`;

    this.http.get<any>(url).subscribe({
      next: res => {
        const translated: string = (res?.responseData?.translatedText || '').trim();
        const status: number     =  res?.responseStatus ?? 0;

        // Quota dépassé
        if (translated.toUpperCase().startsWith('QUERY LENGTH') ||
            translated.toUpperCase().includes('MYMEMORY WARNING')) {
          this.translatingId[a.id]     = false;
          this.translationErrors[a.id] = 'Limite de traduction gratuite atteinte. Réessayez plus tard.';
          return;
        }

        if (status === 200 && translated) {
          const sameAsOriginal = translated.toLowerCase() === a.commentaire.toLowerCase().trim();

          // ── Passe 1 : en|fr → identique → tenter ar|fr
          if (sameAsOriginal && allowFallback && langPair === 'en|fr') {
            this.tryTranslate(a, 'ar|fr', false);
            return;
          }

          // ── Passe 2 : ar|fr → encore identique → le texte est en français → traduire fr|en
          if (sameAsOriginal && langPair === 'ar|fr') {
            this.tryTranslate(a, 'fr|en', false);
            return;
          }

          // ── fr|en → identique (très rare) → on affiche quand même
          this.translatingId[a.id]    = false;
          this.translations[a.id]     = translated;
          // Stocker la langue cible pour afficher le bon badge
          this.translationLang[a.id]  = langPair === 'fr|en' ? 'en' : 'fr';

        } else {
          // Échec → cascade de fallback
          if (allowFallback && langPair === 'en|fr') {
            this.tryTranslate(a, 'ar|fr', false);
          } else if (langPair === 'ar|fr') {
            this.tryTranslate(a, 'fr|en', false);
          } else {
            this.translatingId[a.id]     = false;
            this.translationErrors[a.id] = 'Traduction indisponible pour ce texte.';
          }
        }
      },
      error: () => {
        this.translatingId[a.id]     = false;
        this.translationErrors[a.id] = 'Erreur de connexion. Vérifiez votre réseau.';
      }
    });
  }

  /** Efface la traduction et réaffiche le texte original */
  clearTranslation(avisId: number): void {
    delete this.translations[avisId];
    delete this.translationErrors[avisId];
    delete this.translationLang[avisId];
  }

  /** Libellé du badge selon la langue cible */
  translationBadgeLabel(avisId: number): string {
    return this.translationLang[avisId] === 'en'
      ? '🇬🇧 Traduit en anglais · MyMemory'
      : '🇫🇷 Traduit en français · MyMemory';
  }

  // ── Commentaire d'agriculteur ────────────────────────────
  toggleCommentInput(avisId: number) {
    this.showCommentInput[avisId] = !this.showCommentInput[avisId];
    if (!this.commentInputs[avisId]) this.commentInputs[avisId] = '';
  }

  submitCommentaire(a: AvisResponse) {
    const contenu = (this.commentInputs[a.id] || '').trim();
    if (!contenu) return;
    if (this.badWords.containsBadWord(contenu)) {
      alert('⚠️ Votre réponse contient des mots inappropriés. Veuillez la reformuler.');
      return;
    }
    this.submittingComment[a.id] = true;
    this.api.addCommentaire(a.id, contenu).subscribe({
      next: c => {
        a.commentaires.push(c);
        this.commentInputs[a.id]     = '';
        this.showCommentInput[a.id]  = false;
        this.submittingComment[a.id] = false;
      },
      error: () => { this.submittingComment[a.id] = false; }
    });
  }

  // ── Like ─────────────────────────────────────────────────
  toggleLike(a: AvisResponse) {
    if (a.agriculteurId === this.currentUserId) return;
    this.likingId = a.id;
    this.api.toggleLike(a.id).subscribe({
      next: () => {
        if (a.likedByMe) { a.likedByMe = false; a.nbLikes--; }
        else             { a.likedByMe = true;  a.nbLikes++; }
        this.likingId = null;
      },
      error: () => { this.likingId = null; }
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