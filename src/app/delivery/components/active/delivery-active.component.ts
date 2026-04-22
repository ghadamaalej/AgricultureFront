import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryRequest, DeliveryRequestService } from '../../services/delivery-request.service';

@Component({
  selector: 'app-delivery-active',
  standalone: false,
  templateUrl: './delivery-active.component.html',
  styleUrls: ['./delivery-active.component.css']
})
export class DeliveryActiveComponent implements OnInit {
  activeRequests: DeliveryRequest[] = [];
  notification: string | null = null;
  startingRouteIds = new Set<string>();

  constructor(
    private requestService: DeliveryRequestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.requestService.refreshFromBackend().subscribe(() => this.reload());
  }

  openDetail(id: string): void {
    this.router.navigate(['/delivery/livraisons', id]);
  }

  openRouteWorkflow(request: DeliveryRequest): void {
    if (request.status === 'Acceptée') {
      const blocking = this.getBlockingInProgressRequest(request.id);
      if (blocking) {
        this.notification = `Cannot start ${request.reference}. Please finish or cancel ${blocking.reference} first.`;
        window.setTimeout(() => (this.notification = null), 3600);
        return;
      }
      this.startRouteToPickup(request);
      return;
    }

    this.router.navigate(['/delivery/active', request.id, 'route']);
  }

  private startRouteToPickup(request: DeliveryRequest): void {
    if (this.startingRouteIds.has(request.id)) {
      return;
    }

    this.startingRouteIds.add(request.id);

    this.requestService.startRouteToPickup(request.id).subscribe((result) => {
      this.startingRouteIds.delete(request.id);
      if (!result.success) {
        this.notification = result.errorMessage || 'Unable to start the route at the moment.';
        window.setTimeout(() => (this.notification = null), 3500);
        return;
      }

      this.requestService.refreshFromBackend().subscribe(() => {
        this.reload();
        this.router.navigate(['/delivery/active', request.id, 'route']);
      });
    });
  }

  isStartingRoute(id: string): boolean {
    return this.startingRouteIds.has(id);
  }

  canStartRequest(request: DeliveryRequest): boolean {
    if (request.status !== 'Acceptée') {
      return true;
    }
    return !this.getBlockingInProgressRequest(request.id);
  }

  getStartBlockedReason(request: DeliveryRequest): string {
    const blocking = this.getBlockingInProgressRequest(request.id);
    if (!blocking) {
      return '';
    }
    return `Delivery in progress: ${blocking.reference}. Finish or cancel it first.`;
  }


  private reload(): void {
    this.activeRequests = this.requestService.getTransporterActiveRequests();
  }

  private getBlockingInProgressRequest(requestId: string): DeliveryRequest | null {
    const candidate = this.activeRequests.find((item) => item.status === 'En cours' && item.id !== requestId);
    return candidate || null;
  }
}

