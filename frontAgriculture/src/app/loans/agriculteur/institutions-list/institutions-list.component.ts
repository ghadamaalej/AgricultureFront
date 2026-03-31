import { Component, OnInit } from '@angular/core';
import { Institution } from '../../models/institution';
import { InstitutionService } from '../../../services/loans/institution.service';
import { ServicePretService } from '../../../services/loans/service-pret.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-institutions-list',
  standalone: false,
  templateUrl: './institutions-list.component.html',
  styleUrl: './institutions-list.component.css'
})
export class InstitutionsListComponent implements OnInit {

  institutions: Institution[] = [];
  services: any[] = [];
  selectedId: number | null = null;
  selectedInstitutionName: string = '';

  constructor(
    private institutionService: InstitutionService,
    private agentService: ServicePretService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInstitutions();
  }

  loadInstitutions() {
    this.institutionService.getInstitutions().subscribe({
      next: (data) => this.institutions = data,
      error: (err) => console.error(err)
    });
  }

  selectInstitution(inst: Institution) {
    if (this.selectedId === inst.id) {
      // Toggle off
      this.selectedId = null;
      this.services = [];
      this.selectedInstitutionName = '';
      return;
    }
    this.selectedId = inst.id;
    this.selectedInstitutionName = inst.agence;
    this.loadServices(inst.id);
  }

  loadServices(agentId: number) {
    this.agentService.getALLById(agentId).subscribe({
      next: (data) => this.services = data,
      error: (err) => console.error(err)
    });
  }

  getMaxMontant(): number {
    if (!this.services.length) return 0;
    return Math.max(...this.services.map(s => s.montantMax || 0));
  }

  demanderPret(service: any) {
    console.log('Demande pour:', service);
     this.router.navigate(['/loans/application', service.id]);
  }
}