import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { EventService } from '../../services/event/event.service';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-organisateur-event-list',
  templateUrl: './organisateur-event-list.component.html',
  styleUrls: ['./organisateur-event-list.component.css']
})
export class OrganisateurEventListComponent implements OnInit {

  organisateurId!: number;
  events: any[] = [];

  showSuccess = false;
  message = '';

  constructor(
    private eventService: EventService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = this.authService.getCurrentUserId();
    if (!id) {
      this.router.navigate(['/auth']);
      return;
    }
    this.organisateurId = id;

     this.route.queryParams.subscribe(params => {
    if (params['success']) {
      this.triggerSuccess(params['success']);
    }
  });
  
    this.loadEvents();
  }

  loadEvents(): void {
    this.eventService
      .getEventsByOrganisateur(this.organisateurId)
      .subscribe({
        next: data => (this.events = data),
        error: err => console.error('Error loading events', err)
      });
  }

  goToAdd(): void {
    this.router.navigate(['events/organizer/events/add']);
  }

  goToEdit(ev: any): void {
    this.router.navigate(['events/organizer/events/edit', ev.id]);
  }

  onDelete(id: number): void {
    if (!confirm('Delete this event?')) return;

    this.eventService.deleteEvent(id).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.id !== id);
        this.triggerSuccess('deleted'); 
      },
      error: err => console.error('Error deleting event', err)
    });
  }

  private triggerSuccess(type: 'created' | 'updated' | 'deleted'): void {

    if (type === 'created') {
      this.message = 'Event created successfully!';
    } else if (type === 'updated') {
      this.message = 'Event updated successfully!';
    } else if (type === 'deleted') {
      this.message = 'Event deleted successfully!';
    }

    this.showSuccess = true;

    setTimeout(() => {
      this.showSuccess = false;
    }, 3000);
  }
}