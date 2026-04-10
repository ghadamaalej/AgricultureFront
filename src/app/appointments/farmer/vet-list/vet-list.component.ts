import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { VetUser } from '../../models/appointments.models';

@Component({
  selector: 'app-vet-list',
  standalone: false,
  templateUrl: './vet-list.component.html',
  styleUrls: ['./vet-list.component.css']
})
export class VetListComponent implements OnInit {
  @Output() booked = new EventEmitter<void>();
  @Output() openChatLayout = new EventEmitter<void>();

  vets: VetUser[] = [];
  filtered: VetUser[] = [];
  loading = true;
  searchTerm = '';
  selectedVet: VetUser | null = null;

  constructor(private api: AppointmentsApiService) {}

  ngOnInit() {
    this.api.getAllVets().subscribe({
      next: v => { this.vets = v; this.filtered = v; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  search() {
    const t = this.searchTerm.toLowerCase().trim();
    if (!t) { this.filtered = this.vets; return; }
    this.filtered = this.vets.filter(v =>
      v.nom?.toLowerCase().includes(t) ||
      v.prenom?.toLowerCase().includes(t) ||
      v.region?.toLowerCase().includes(t) ||
      `${v.prenom} ${v.nom}`.toLowerCase().includes(t)
    );
  }

  selectVet(v: VetUser) { this.selectedVet = v; }
  backToList() { this.selectedVet = null; }
  onBooked() { this.selectedVet = null; this.booked.emit(); }

  onOpenChat(vetId: number) {
    localStorage.setItem('chatVetId', String(vetId));
    this.selectedVet = null;
    this.openChatLayout.emit();
  }

  initials(v: VetUser) {
    return `${v.prenom?.charAt(0)||''}${v.nom?.charAt(0)||''}`.toUpperCase();
  }
}
