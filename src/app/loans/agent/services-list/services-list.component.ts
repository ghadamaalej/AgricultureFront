import { Component, OnInit } from '@angular/core';
import { ServicePretService } from '../../../services/loans/service-pret.service';
import { Service } from '../../models/service';
import { Router } from '@angular/router';
import {DemandePretService} from '../../../services/loans/demande-pret.service';

@Component({
  selector: 'app-services-list',
  standalone: false,
  templateUrl: './services-list.component.html',
  styleUrl: './services-list.component.css'
})
export class ServicesListComponent implements OnInit {
   services: Service[] = [];

  loading: boolean = false;
  successMsg: string = '';
  errorMsg: string = '';
  deleteConfirmId: number | null = null;

  constructor(
    private agentService: ServicePretService,
    private router: Router,
    private demandePretService: DemandePretService
  ) {}
 activeTab: { [id: string]: string } = {};

setTab(id: number | undefined, tab: string) {
  if (id === undefined) return;
  this.activeTab[id] = tab;
}
  ngOnInit(): void {
    this.loadServices();

  }

  loadServices() {
    this.loading = true;

    this.agentService.getAll().subscribe({
      next: (data) => {
        this.services = data;
        this.loading = false;
        this.services.forEach(s => {
          if (s.id !== undefined) {
            this.activeTab[s.id] = 'eligibility';
            
            // ← ajoute ça
            this.demandePretService.countByService(s.id).subscribe(count => {
              s.nombreDemandes = count;
            });
          }
        });
      },
      error: () => {
        this.errorMsg = "Erreur lors du chargement";
        this.loading = false;
      }
    });
  }

  editService(id?: number) {
  if (!id) return;
  this.router.navigate(['/loans/agent/services/edit', id]);
}

  
  confirmDelete(id?: number) {
    if (!id) return;
    this.deleteConfirmId = id;
  }


  cancelDelete() {
    this.deleteConfirmId = null;
  }


  deleteService(id: number) {
    this.agentService.delete(id).subscribe({
      next: () => {
        this.successMsg = "Service supprimé avec succès";
        this.deleteConfirmId = null;
        this.loadServices();
      },
      error: () => {
        this.errorMsg = "Erreur lors de la suppression";
        this.deleteConfirmId = null;
      }
    });
  }
  viewApplications(serviceId: number) {
  this.router.navigate(['/loans/agent/applications', serviceId]);
}



}
