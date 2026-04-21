import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DemandePretService } from '../../../services/loans/demande-pret.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-applications-list',
  standalone: false,
  templateUrl: './applications-list.component.html',
  styleUrls: ['./applications-list.component.css']
})
export class ApplicationsListComponent implements OnInit {

  applications: any[] = [];

  searchText: string = '';
  selectedStatus: string = '';

  constructor(private router: Router,
    private service: DemandePretService,
      private route: ActivatedRoute,

  ) {}

  ngOnInit(): void {
  const serviceId = this.route.snapshot.paramMap.get('id');
  if (serviceId) {
    this.loadApplications(+serviceId);
  }
}


  loadApplications(serviceId: number) {
  this.service.getByService(serviceId).subscribe({
  next: (data: any) => {
    console.log("DATA OK:", data);
    this.applications = data;
  },
  error: (err: any) => {
    console.log("FULL ERROR:", err);
  }
});
}

  
  filteredApplications() {

    if (!this.applications) return [];

    return this.applications.filter(app => {

      const matchesSearch =
        !this.searchText ||
        app.farmerName?.toLowerCase().includes(this.searchText.toLowerCase()) ||
        app.montant?.toString().includes(this.searchText) ||
        app.duree?.toString().includes(this.searchText);

      const matchesStatus =
        !this.selectedStatus || app.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }
  getScoreClass(score: number) {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }

  
  acceptAndCreateLoan(id: number) {
    console.log("Accept + Create Loan:", id);

    
  }

  refuse(id: number) {
    console.log("Refuse:", id);

    
  }

  viewDocuments(id: number) {
    console.log("View documents:", id);

    //this.router.navigate(['/loans/agent/documents', id]);
  }
  badgeClass(statut: string): string {
  if (statut === 'ACCEPTE') return 'badge-accepted';
  if (statut === 'REFUSE') return 'badge-rejected';
  return 'badge-pending';
}

badgeLabel(statut: string): string {
  if (statut === 'ACCEPTE') return 'Accepted';
  if (statut === 'REFUSE') return 'Refused';
  return 'Pending';
}

scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 70) return '#ca8a04';
  return '#dc2626';
}

}