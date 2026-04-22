import { Component, OnInit } from '@angular/core';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { AuthService } from '../../../services/auth/auth.service';
import { AvisResponse, VetRatingSummary } from '../../models/appointments.models';

@Component({
  selector: 'app-vet-avis',
  standalone: false,
  templateUrl: './vet-avis.component.html',
  styleUrls: ['./vet-avis.component.css']
})
export class VetAvisComponent implements OnInit {

  avis: AvisResponse[] = [];
  summary: VetRatingSummary | null = null;
  loading = true;
  error = '';

  currentVetId!: number;

  // Réponses vétérinaire
  replyInputs: { [avisId: number]: string } = {};
  showReplyInput: { [avisId: number]: boolean } = {};
  submittingReply: { [avisId: number]: boolean } = {};
  replyError: { [avisId: number]: string } = {};

  // Filtre
  filterNote: number | null = null;
  stars5 = [1, 2, 3, 4, 5];

  constructor(
    private api: AppointmentsApiService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.currentVetId = this.auth.getCurrentUserId()!;
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';

    this.api.getVetRatingSummary(this.currentVetId).subscribe({
      next: s => { this.summary = s; },
      error: () => {}
    });

    this.api.getAvisByVet(this.currentVetId).subscribe({
      next: list => {
        this.avis = list;
        this.loading = false;
      },
      error: e => {
        this.loading = false;
        this.error = e.error?.message || 'Erreur lors du chargement des avis';
      }
    });
  }

  // ── Filtrage par note ─────────────────────────────────────
  setFilter(n: number | null) { this.filterNote = n; }

  get filteredAvis(): AvisResponse[] {
    if (this.filterNote === null) return this.avis;
    return this.avis.filter(a => a.note === this.filterNote);
  }

  countByNote(n: number): number {
    return this.avis.filter(a => a.note === n).length;
  }

  // ── Répondre à un avis ───────────────────────────────────
  toggleReplyInput(avisId: number) {
    this.showReplyInput[avisId] = !this.showReplyInput[avisId];
    if (!this.replyInputs[avisId]) this.replyInputs[avisId] = '';
    this.replyError[avisId] = '';
  }

  submitReply(a: AvisResponse) {
    const contenu = (this.replyInputs[a.id] || '').trim();
    if (!contenu) { this.replyError[a.id] = 'La réponse ne peut pas être vide.'; return; }

    this.submittingReply[a.id] = true;
    this.replyError[a.id] = '';

    this.api.addReponseVet(a.id, contenu).subscribe({
      next: rep => {
        a.reponseVet = rep;
        this.replyInputs[a.id] = '';
        this.showReplyInput[a.id] = false;
        this.submittingReply[a.id] = false;
      },
      error: e => {
        this.submittingReply[a.id] = false;
        this.replyError[a.id] = e.error?.message || 'Erreur lors de l\'envoi de la réponse';
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

  starsArray(note: number): boolean[] {
    return [1, 2, 3, 4, 5].map(i => i <= Math.round(note));
  }

  distributionWidth(star: number): number {
    if (!this.summary || this.summary.totalAvis === 0) return 0;
    return Math.round(((this.summary.distribution?.[star] || 0) / this.summary.totalAvis) * 100);
  }

  distributionCount(star: number): number {
    return this.summary?.distribution?.[star] || 0;
  }

  get averageDisplay(): string {
    if (!this.summary || this.summary.totalAvis === 0) return '—';
    return this.summary.moyenneNote.toFixed(1);
  }

  noteLabel(n: number): string {
    return ['', 'Mauvais', 'Insuffisant', 'Bien', 'Très bien', 'Excellent'][n] || '';
  }

  trackById(_: number, a: AvisResponse) { return a.id; }
}
