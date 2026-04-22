import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClaimsService } from '../../services/claims.service';
import { ReclamationResponse, STATUS_LABELS, CATEGORY_LABELS, PRIORITY_LABELS } from '../../models/claims.models';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-my-claims',
  standalone: false,
  templateUrl: './my-claims.component.html',
  styleUrls: ['./my-claims.component.css']
})
export class MyClaimsComponent implements OnInit {

  claims: ReclamationResponse[] = [];
  loading = true;
  error: string | null = null;

  STATUS_LABELS = STATUS_LABELS;
  CATEGORY_LABELS = CATEGORY_LABELS;
  PRIORITY_LABELS = PRIORITY_LABELS;

  constructor(
    private claimsService: ClaimsService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      this.router.navigate(['/claims/auth']);
      return;
    }
    this.claimsService.getByUser(userId).subscribe({
      next: (data) => { this.claims = data; this.loading = false; },
      error: () => { this.error = 'Impossible de charger vos réclamations.'; this.loading = false; }
    });
  }

  openDetail(id: number): void {
    this.router.navigate(['/claims/detail', id]);
  }

  newClaim(): void {
    this.router.navigate(['/claims/new']);
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'badge-pending',
      EN_COURS: 'badge-progress',
      RESOLUE: 'badge-resolved',
      REJETEE: 'badge-rejected'
    };
    return map[status] || '';
  }

  priorityClass(p: string): string {
    const map: Record<string, string> = { BASSE: 'prio-low', MOYENNE: 'prio-medium', HAUTE: 'prio-high' };
    return map[p] || '';
  }
}
