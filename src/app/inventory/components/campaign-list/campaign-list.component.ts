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

  constructor(private api: InventoryApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';

    this.api.getAllCampaigns().subscribe({
      next: (c) => {
        this.campaigns = c;
        this.loading = false;
      },
      error: (e) => {
        console.error(e);
        this.error = e.error?.message || 'Erreur de chargement';
        this.loading = false;
      }
    });
  }

  statusLabel(s: string) {
    return {
      PLANNED: 'Planifiée',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminée'
    }[s] || s;
  }

  statusClass(s: string) {
    return {
      PLANNED: 'st-planned',
      IN_PROGRESS: 'st-progress',
      COMPLETED: 'st-done'
    }[s] || '';
  }

  markDone(campaignId: number) {
    if (!confirm('Confirmer la vaccination de tous les animaux de cette campagne ?')) {
      return;
    }

    this.api.vaccinateCampaign(campaignId).subscribe({
      next: () => {
        this.load();
      },
      error: (e) => {
        console.error(e);
        alert(e.error?.message || 'Erreur lors de la validation de la campagne');
      }
    });
  }
}