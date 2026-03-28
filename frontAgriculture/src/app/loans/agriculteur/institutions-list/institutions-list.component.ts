import { Component, OnInit } from '@angular/core';
import { Institution } from '../../models/institution';
import { InstitutionService } from '../../../services/loans/institution.service';
import { ServicePretService } from '../../../services/loans/service-pret.service';

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
    private agentService: ServicePretService
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
    // Navigate or open modal for loan request
    console.log('Demande pour:', service);
    // this.router.navigate(['/loans/apply', service.id]);
  }
}