import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EventListItem } from 'src/app/models/event-list.model';
import { Events } from 'src/app/models/events';
import { EventService } from 'src/app/services/event/event.service';

@Component({
  selector: 'app-list-events',
  templateUrl: './list-events.component.html',
  styleUrls: ['./list-events.component.css']
})
export class ListComponent implements OnInit {

  events: EventListItem[] = [];

  loading: boolean = true;

  constructor(private eventService: EventService, private router: Router ) {}

  ngOnInit(): void {
  this.loading = true;

  this.eventService.getAllEvents().subscribe({
    next: (data) => {
      this.events = data;
      this.loading = false;
    },
    error: () => {
      this.loading = false;
    }
  });
}
  
  goToDetails(id: number) {
    this.router.navigate(['/events/detailsEvent', id]); 
    window.scrollTo(0, 0);
  }

  openMapView(): void {
    this.router.navigate(['/events/map']);
  }

  openMapForEvent(eventId: number): void {
    this.router.navigate(['/events/map'], { queryParams: { focusId: eventId } });
  }

  getPourcentage(inscrits: number, capacite: number): number {
    return (inscrits || 0) / capacite * 100;
  }

  getCouleur(inscrits: number, capacite: number): string {
    const pourcentage = this.getPourcentage(inscrits, capacite);
    
    if (pourcentage == 100) return '#dc3545';      
    if (pourcentage >= 70 && pourcentage < 99) return '#dbbf0a';      
    return '#3cb054';                             
  }
}