import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryRequestService } from '../../services/delivery-request.service';

@Component({
  selector: 'app-transporter-calendar-page',
  templateUrl: './transporter-calendar-page.component.html',
  styleUrls: ['./transporter-calendar-page.component.css']
})
export class TransporterCalendarPageComponent implements OnInit {
  currentUserId: number = 0;
  isLoading: boolean = false;

  constructor(
    private deliveryService: DeliveryRequestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.deliveryService.getCurrentUserId();
  }

  onDateSelected(date: string): void {
    void date;
  }

  onDeliverySelected(delivery: any): void {
    const deliveryId = delivery?.livraisonId ?? delivery?.id;
    if (deliveryId) {
      this.router.navigate(['/delivery/livraisons', deliveryId]);
    }
  }
}
