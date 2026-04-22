import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Events } from 'src/app/models/events';
import { EventService } from 'src/app/services/event/event.service';

@Component({
  selector: 'app-list-events',
  templateUrl: './list-events.component.html',
  styleUrls: ['./list-events.component.css']
})
export class ListComponent implements OnInit {

  events: Events[] = [];

  constructor(private eventService: EventService, private router: Router ) {}

  ngOnInit(): void {
    this.eventService.getAllEvents().subscribe(data => {
      this.events = data;
    });
  }
  goToDetails(id: number) {
    this.router.navigate(['/events/detailsEvent', id]); 
    window.scrollTo(0, 0);
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