import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ClaimsService } from '../../services/claims.service';
import { AuthService } from '../../../services/auth/auth.service';
import {
  ReclamationResponse, ReclamationStatus,
  STATUS_LABELS, CATEGORY_LABELS, PRIORITY_LABELS
} from '../../models/claims.models';

@Component({
  selector: 'app-claim-detail',
  standalone: false,
  templateUrl: './claim-detail.component.html',
  styleUrls: ['./claim-detail.component.css']
})
export class ClaimDetailComponent implements OnInit {

  claim: ReclamationResponse | null = null;
  loading = true;
  error: string | null = null;

  newMessage = '';
  sendingMessage = false;
  messageError: string | null = null;

  STATUS_LABELS = STATUS_LABELS;
  CATEGORY_LABELS = CATEGORY_LABELS;
  PRIORITY_LABELS = PRIORITY_LABELS;

  isAdmin = false;
  currentUserId: number | null = null;

  statuses: ReclamationStatus[] = ['EN_ATTENTE', 'EN_COURS', 'RESOLUE', 'REJETEE'];
  selectedStatus: ReclamationStatus | null = null;
  updatingStatus = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private claimsService: ClaimsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.isAdmin = user?.role === 'ADMIN';
    this.currentUserId = user?.userId ?? null;

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.load(id);
  }

  load(id: number): void {
    this.loading = true;
    this.claimsService.getById(id).subscribe({
      next: (data) => {
        this.claim = data;
        this.selectedStatus = data.status;
        this.loading = false;
      },
      error: () => {
        this.error = 'Réclamation introuvable.';
        this.loading = false;
      }
    });
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.claim) return;

    const userId = this.currentUserId;
    if (!userId) return;

    this.sendingMessage = true;
    this.messageError = null;

    this.claimsService.addMessage(this.claim.id, {
      senderId: userId,
      senderRole: this.isAdmin ? 'ADMIN' : 'USER',
      message: this.newMessage.trim()
    }).subscribe({
      next: (updated) => {
        this.claim = updated;
        this.newMessage = '';
        this.sendingMessage = false;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: () => {
        this.messageError = 'Erreur lors de l\'envoi du message.';
        this.sendingMessage = false;
      }
    });
  }

  updateStatus(): void {
    if (!this.claim || !this.selectedStatus) return;
    this.updatingStatus = true;
    this.claimsService.updateStatus(this.claim.id, { status: this.selectedStatus }).subscribe({
      next: (updated) => {
        this.claim = updated;
        this.updatingStatus = false;
      },
      error: () => { this.updatingStatus = false; }
    });
  }

  back(): void {
    if (this.isAdmin) {
      this.router.navigate(['/dashboard/claims']);
    } else {
      this.router.navigate(['/claims/my-claims']);
    }
  }

  isClosed(): boolean {
    return this.claim?.status === 'RESOLUE' || this.claim?.status === 'REJETEE';
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { EN_ATTENTE: 'badge-pending', EN_COURS: 'badge-progress', RESOLUE: 'badge-resolved', REJETEE: 'badge-rejected' };
    return m[s] || '';
  }

  priorityClass(p: string): string {
    return { BASSE: 'prio-low', MOYENNE: 'prio-medium', HAUTE: 'prio-high' }[p] || '';
  }

  private scrollToBottom(): void {
    const el = document.querySelector('.messages-list');
    if (el) el.scrollTop = el.scrollHeight;
  }
}
