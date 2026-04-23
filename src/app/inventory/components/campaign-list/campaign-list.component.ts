import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { InventoryApiService } from '../../services/inventory-api.service';
import { VaccinationCampaign } from '../../models/inventory.models';

@Component({
  selector: 'app-campaign-list',
  standalone: false,
  templateUrl: './campaign-list.component.html',
  styleUrls: ['./campaign-list.component.css']
})
export class CampaignListComponent implements OnInit {
  @Output() back = new EventEmitter<void>();

  campaigns: VaccinationCampaign[] = [];
  loading = true;
  error = '';

  // ── Calendrier ──
  today = new Date();
  currentYear  = this.today.getFullYear();
  currentMonth = this.today.getMonth(); // 0-indexed

  selectedDay: number | null = null;
  selectedCampaigns: VaccinationCampaign[] = [];
  hoveredDay: number | null = null;

  readonly MONTH_NAMES = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
  ];
  readonly DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  constructor(private api: InventoryApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.error   = '';
    this.api.getAllCampaigns().subscribe({
      next: (c) => { this.campaigns = c; this.loading = false; },
      error: (e) => {
        this.error   = e.error?.message || 'Erreur de chargement';
        this.loading = false;
      }
    });
  }

  // ── Navigation mois ──
  prevMonth() {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else { this.currentMonth--; }
    this.selectedDay = null;
    this.selectedCampaigns = [];
  }

  nextMonth() {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else { this.currentMonth++; }
    this.selectedDay = null;
    this.selectedCampaigns = [];
  }

  goToToday() {
    this.currentYear  = this.today.getFullYear();
    this.currentMonth = this.today.getMonth();
    this.selectedDay  = null;
    this.selectedCampaigns = [];
  }

  // ── Construction grille ──
  /** Retourne les cases de la grille (nulls = cases vides avant le 1er) */
  get calendarDays(): (number | null)[] {
    const firstDow = new Date(this.currentYear, this.currentMonth, 1).getDay();
    // getDay() : 0=dim,1=lun…6=sam → on veut lun=0
    const offset = (firstDow === 0 ? 6 : firstDow - 1);
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  /** Campagnes planifiées pour un jour donné */
  campaignsForDay(day: number): VaccinationCampaign[] {
    const key = this.isoDate(this.currentYear, this.currentMonth, day);
    return this.campaigns.filter(c => c.plannedDate === key);
  }

  isoDate(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  isToday(day: number): boolean {
    return day === this.today.getDate()
      && this.currentMonth === this.today.getMonth()
      && this.currentYear  === this.today.getFullYear();
  }

  // ── Sélection ──
  selectDay(day: number | null) {
    if (!day) return;
    if (this.selectedDay === day) {
      this.selectedDay = null;
      this.selectedCampaigns = [];
    } else {
      this.selectedDay = day;
      this.selectedCampaigns = this.campaignsForDay(day);
    }
  }

  // ── Statuts ──
  statusLabel(s: string) {
    return ({ PLANNED:'Planifiée', IN_PROGRESS:'En cours', COMPLETED:'Terminée' } as any)[s] || s;
  }

  statusClass(s: string) {
    return ({ PLANNED:'st-planned', IN_PROGRESS:'st-progress', COMPLETED:'st-done' } as any)[s] || '';
  }

  statusIcon(s: string) {
    return ({ PLANNED:'fa-clock', IN_PROGRESS:'fa-spinner', COMPLETED:'fa-check-circle' } as any)[s] || 'fa-circle';
  }

  // ── Action ──
  markDone(campaignId: number) {
    if (!confirm('Confirmer la vaccination de tous les animaux de cette campagne ?')) return;
    this.api.vaccinateCampaign(campaignId).subscribe({
      next: () => { this.load(); this.selectedCampaigns = []; this.selectedDay = null; },
      error: (e) => alert(e.error?.message || 'Erreur lors de la validation')
    });
  }

  // ── Stats rapides ──
  get totalPlanned()   { return this.campaigns.filter(c => c.status === 'PLANNED').length; }
  get totalInProgress(){ return this.campaigns.filter(c => c.status === 'IN_PROGRESS').length; }
  get totalDone()      { return this.campaigns.filter(c => c.status === 'COMPLETED').length; }

  get campaignsThisMonth(): VaccinationCampaign[] {
    const prefix = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2,'0')}`;
    return this.campaigns.filter(c => c.plannedDate?.startsWith(prefix));
  }
}