import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryRequestService } from '../../services/delivery-request.service';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

@Component({
  selector: 'app-transporter-stats-page',
  templateUrl: './transporter-stats-page.component.html',
  styleUrls: ['./transporter-stats-page.component.css']
})
export class TransporterStatsPageComponent implements OnInit {
  currentUserId: number = 0;
  isTransporter = false;

  constructor(private deliveryService: DeliveryRequestService, private router: Router) {}

  ngOnInit(): void {
    const role = getDeliveryUserRole();
    this.isTransporter = role === 'transporteur' || role === 'transporter' || role.includes('transport');
    if (!this.isTransporter) {
      this.router.navigate(['/delivery/dashboard']);
      return;
    }
    this.currentUserId = this.deliveryService.getCurrentUserId();
  }
}
