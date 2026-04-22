import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryRequestService } from '../../services/delivery-request.service';
type CalendarDay = {
  date: string;
  items: Array<{
    id: string;
    reference: string;
    status: string;
    pickupLabel: string;
    dropoffLabel: string;
  }>;
};
@Component({
  selector: 'app-delivery-calendar',
  standalone: false,
  templateUrl: './delivery-calendar.component.html',
  styleUrls: ['./delivery-calendar.component.css']
})
export class DeliveryCalendarComponent implements OnInit {
  days: CalendarDay[] = [];
  constructor(private requestService: DeliveryRequestService, private router: Router) {}
  ngOnInit(): void {
    this.requestService.refreshFromBackend().subscribe(() => this.loadCalendar());
    this.loadCalendar();
  }

  private loadCalendar(): void {
    const requests = this.requestService.getTransporterCalendarRequests();
    const byDate = new Map<string, CalendarDay>();

    requests.forEach((r) => {
      const date = new Date(r.createdAt).toLocaleDateString('fr-FR');
      if (!byDate.has(date)) {
        byDate.set(date, { date, items: [] });
      }
      byDate.get(date)?.items.push({
        id: r.id,
        reference: r.reference,
        status: r.status,
        pickupLabel: r.pickupLabel,
        dropoffLabel: r.dropoffLabel
      });
    });
    this.days = Array.from(byDate.values());
  }
  openDetail(id: string): void {
    this.router.navigate(['/delivery/livraisons', id]);
  }
}
