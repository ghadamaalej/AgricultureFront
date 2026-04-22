import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Events } from 'src/app/models/events';
import { EventService } from 'src/app/services/event/event.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-dashboard-event',
  templateUrl: './dashboard-event.component.html',
  styleUrl: './dashboard-event.component.css'
})
export class DashboardEventComponent  implements OnInit {

  events:  Events[] = [];
  filteredEvents:  Events[] = [];
  selectedEvent:  Events | null = null;

previewUrl: SafeResourceUrl | null = null;
  filterStatut: string = 'ALL';
  loading = false;

  toastMessage: string = '';
  toastType: 'success' | 'error' | '' = '';

  private apiUrl = 'http://localhost:8089/evenement/api/event';

  constructor(private http: HttpClient,private eventService: EventService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  getStatus(event: Events): string {
    if (event.isValid === true) return 'VALIDATED';
    if (event.isValid === false) return 'REJECTED';
    return 'PLANNED';
  }

  loadEvents(): void {
  this.loading = true;
  this.http.get<Events[]>(`${this.apiUrl}/getAllEvents`).subscribe({
    next: (data) => {
      this.events = Array.isArray(data) ? data : []; 
      this.applyFilter();
      this.loading = false;
    },
    error: () => {
      this.loading = false;
      this.showToast('Error loading events', 'error');
    }
  });
}

  applyFilter(): void {
    this.filteredEvents = this.filterStatut === 'ALL'
      ? this.events
      : this.events.filter(e => this.getStatus(e) === this.filterStatut);
  }

  setFilter(statut: string): void {
    this.filterStatut = statut;
    this.applyFilter();
  }


  selectEvent(event: Events): void {
    this.selectedEvent = event;
    this.previewUrl = null;
  }

  closeDetail(): void {
    this.selectedEvent = null;
    this.previewUrl = null;
  }

previewDocument() {
  if (this.selectedEvent?.autorisationmunicipale) {
    const fileName = this.selectedEvent.autorisationmunicipale;

    const url = this.eventService.getDocumentUrl(fileName);

    this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}

  validateEvent(): void {
    if (!this.selectedEvent) return;

    this.http.put(`${this.apiUrl}/validate/${this.selectedEvent.id}`, {})
      .subscribe({
        next: () => {
          this.selectedEvent!.isValid = true;
          this.updateLocalEvent(this.selectedEvent!);
          this.showToast('Event validated', 'success');
        },
        error: () => this.showToast('Validation error', 'error')
      });
  }

  rejectEvent(): void {
    if (!this.selectedEvent) return;

    this.http.put(`${this.apiUrl}/reject/${this.selectedEvent.id}`, {})
    .subscribe({
        next: () => {
          this.selectedEvent!.isValid = false;
          this.updateLocalEvent(this.selectedEvent!);
          this.showToast('Event rejected', 'success');
        },
        error: () => this.showToast('Reject error', 'error')
      });
  }

  private updateLocalEvent(updated: Events): void {
    const idx = this.events.findIndex(e => e.id === updated.id);
    if (idx !== -1) this.events[idx] = { ...updated };
    this.applyFilter();
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
      this.toastType = '';
    }, 3000);
  }

  countByStatut(statut: string): number {
    return this.events.filter(e => this.getStatus(e) === statut).length;
  }

  getDocumentName(path: string | null): string {
    if (!path) return 'No document';
    return path.split('/').pop() || path;
  }

  getDocumentUrl(fileName: string): string {
  return `assets/images/${encodeURIComponent(fileName)}`;
}
}