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
  error   = '';

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.api.getAllCampaigns().subscribe({
      next: c => { this.campaigns = c; this.loading = false; },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  statusLabel(s: string) {
    return { PLANNED: 'Planifiée', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée' }[s] || s;
  }
  statusClass(s: string) {
    return { PLANNED: 'st-planned', IN_PROGRESS: 'st-progress', COMPLETED: 'st-done' }[s] || '';
  }
}
