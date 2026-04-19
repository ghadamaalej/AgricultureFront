import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClaimsService } from '../../services/claims.service';
import {
  ReclamationCategory, ReclamationResponse, ReclamationStatus,
  STATUS_LABELS, CATEGORY_LABELS, PRIORITY_LABELS
} from '../../models/claims.models';

@Component({
  selector: 'app-admin-claims',
  standalone: false,
  templateUrl: './admin-claims.component.html',
  styleUrls: ['./admin-claims.component.css']
})
export class AdminClaimsComponent implements OnInit {

  claims: ReclamationResponse[] = [];
  filtered: ReclamationResponse[] = [];
  loading = true;
  error: string | null = null;

  STATUS_LABELS = STATUS_LABELS;
  CATEGORY_LABELS = CATEGORY_LABELS;
  PRIORITY_LABELS = PRIORITY_LABELS;

  filterStatus: ReclamationStatus | '' = '';
  filterCategory = '';
  searchText = '';

  statuses: Array<{ value: ReclamationStatus | ''; label: string }> = [
    { value: '', label: 'Tous les statuts' },
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'EN_COURS',   label: 'En cours' },
    { value: 'RESOLUE',    label: 'Résolue' },
    { value: 'REJETEE',    label: 'Rejetée' }
  ];

  constructor(private claimsService: ClaimsService, private router: Router) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.claimsService.getAll().subscribe({
      next: (data) => {
        this.claims = data;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les réclamations.';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filtered = this.claims.filter(c => {
      const matchStatus   = !this.filterStatus   || c.status === this.filterStatus;
      const matchCategory = !this.filterCategory || c.category === this.filterCategory;
      const matchSearch   = !this.searchText     ||
        c.subject.toLowerCase().includes(this.searchText.toLowerCase()) ||
        c.userFullName?.toLowerCase().includes(this.searchText.toLowerCase()) ||
        c.userEmail?.toLowerCase().includes(this.searchText.toLowerCase());
      return matchStatus && matchCategory && matchSearch;
    });
  }

  openDetail(id: number): void {
    this.router.navigate(['/dashboard/claims', id]);
  }

  get countByStatus(): Record<string, number> {
    const map: Record<string, number> = { EN_ATTENTE: 0, EN_COURS: 0, RESOLUE: 0, REJETEE: 0 };
    this.claims.forEach(c => map[c.status] = (map[c.status] || 0) + 1);
    return map;
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { EN_ATTENTE: 'badge-pending', EN_COURS: 'badge-progress', RESOLUE: 'badge-resolved', REJETEE: 'badge-rejected' };
    return m[s] || '';
  }

  priorityClass(p: string): string {
    return { BASSE: 'prio-low', MOYENNE: 'prio-medium', HAUTE: 'prio-high' }[p] || '';
  }

  categoryLabel(category: ReclamationCategory): string {
    return this.CATEGORY_LABELS[category];
  }

  uniqueCategories(): ReclamationCategory[] {
    return [...new Set(this.claims.map(c => c.category))];
  }
}
