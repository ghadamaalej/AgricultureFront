import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { CalendarDay, DeliveryExtendedService } from '../../services/delivery-extended.service';
import { DeliveryRequest, DeliveryRequestService, DeliveryRequestStatus } from '../../services/delivery-request.service';

type DeliveryHistorySection = {
  key: 'delivered' | 'inProgress' | 'accepted';
  title: string;
  subtitle: string;
  icon: string;
  requests: DeliveryRequest[];
};

@Component({
  selector: 'app-delivery-history',
  standalone: false,
  templateUrl: './delivery-history.component.html',
  styleUrls: ['./delivery-history.component.css']
})
export class DeliveryHistoryComponent implements OnInit {
  timeline: DeliveryRequest[] = [];
  sections: DeliveryHistorySection[] = [];
  probableArrivalByDeliveryId: Record<string, string> = {};
  readonly sectionPageSize = 4;
  sectionPageByKey: Record<DeliveryHistorySection['key'], number> = {
    delivered: 1,
    inProgress: 1,
    accepted: 1
  };
  readonly isFarmer = this.requestService.isUserFarmerRole();

  get pageTitle(): string {
    return this.isFarmer ? 'My request history' : 'Transporter history and tracking';
  }

  get pageSubtitle(): string {
    return this.isFarmer
      ? 'Find your accepted, in-progress and delivered requests.'
      : 'A useful view of your delivered, in-progress and already accepted missions.';
  }

  get emptyStateMessage(): string {
    return this.isFarmer
      ? 'No request history at the moment.'
      : 'No transporter mission to display.';
  }

  constructor(
    private requestService: DeliveryRequestService,
    private extendedService: DeliveryExtendedService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.requestService.refreshFromBackend().subscribe(() => {
      this.timeline = this.isFarmer
        ? this.requestService.getFarmerTimelineRequests()
        : this.requestService.getTransporterTimelineRequests();
      this.sections = this.buildSections(this.timeline);
      this.syncSectionPages();
      this.loadProbableArrivals(this.timeline);
    });
  }

  openDetail(id: string): void {
    this.router.navigate(['/delivery/livraisons', id]);
  }

  needsSignature(req: DeliveryRequest): boolean {
    return req.status === 'Livrée' && req.signatureStatus === 'PENDING_SIGNATURE' && this.isFarmer;
  }

  goTo(route: string): void {
    this.router.navigate([route]);
  }

  getSectionCount(key: DeliveryHistorySection['key']): number {
    return this.sections.find((section) => section.key === key)?.requests.length || 0;
  }

  getStatusLabel(status: DeliveryRequestStatus): string {
    switch (status) {
      case 'Livrée':
        return 'Delivery completed';
      case 'En cours':
        return 'Active mission';
      case 'Acceptée':
        return 'Planned mission';
      default:
        return status;
    }
  }

  getJourneyMoment(req: DeliveryRequest): string {
    if (req.status === 'Livrée') {
      return req.deliveredAt ? `Delivered on ${this.formatDateTime(req.deliveredAt)}` : 'Delivered and archived';
    }
    if (req.status === 'En cours') {
      return req.plannedDeliveryDate
        ? `Target window ${this.formatDateTime(req.plannedDeliveryDate)}`
        : 'Trip in progress';
    }

    const probableArrival = this.getProbableArrival(req);
    if (probableArrival) {
      return `Probable arrival ${probableArrival}`;
    }

    return req.departureDate
      ? `Planned departure ${this.formatDateTime(req.departureDate)}`
      : 'Awaiting departure';
  }

  getInsightLabel(req: DeliveryRequest): string {
    if (req.status === 'Livrée') {
      return req.rating ? `Rating ${req.rating.toFixed(1)}/5` : 'Mission finalized';
    }
    if (req.status === 'En cours') {
      return req.grouped && req.groupReference ? `Tour ${req.groupReference}` : 'Direct trip';
    }
    return req.grouped && req.groupReference ? `Pre-grouped ${req.groupReference}` : 'Probable arrival';
  }

  getInsightValue(req: DeliveryRequest): string {
    if (req.status === 'Livrée') {
      return this.formatCurrency(req.estimatedPrice);
    }
    if (req.status === 'En cours') {
      return `${this.getDistanceKm(req).toFixed(1)} km`;
    }
    return this.getProbableArrival(req) || `${req.weightKg.toFixed(0)} kg`;
  }

  getHighlightTitle(req: DeliveryRequest): string {
    if (req.status === 'Livrée') {
      return 'Summary';
    }
    if (req.status === 'En cours') {
      return 'Tracking';
    }
    return 'Preparation';
  }

  getHighlightText(req: DeliveryRequest): string {
    if (req.status === 'Livrée') {
      if (req.rating) {
        return `Trip closed with a client rating of ${req.rating.toFixed(1)}/5.`;
      }
      return 'Trip closed. Revenue and route trace preserved in history.';
    }
    if (req.status === 'En cours') {
      return req.grouped && req.groupReference
        ? `Delivery integrated in tour ${req.groupReference}. Follow the stop sequence on the map.`
        : 'Active mission. Priority on respecting the scheduled slot and final handover.';
    }

    const probableArrival = this.getProbableArrival(req);
    return probableArrival
      ? `Mission accepted. The transporter schedule estimates arrival around ${probableArrival}.`
      : 'Mission accepted. Verify the loading, availability and departure before setting off.';
  }

  getCardClass(req: DeliveryRequest): string {
    switch (req.status) {
      case 'Livrée':
        return 'history-card--delivered';
      case 'En cours':
        return 'history-card--in-progress';
      case 'Acceptée':
        return 'history-card--accepted';
      default:
        return '';
    }
  }

  getProgressPercent(req: DeliveryRequest): number {
    if (req.status === 'Livrée') {
      return 100;
    }
    if (req.status === 'En cours') {
      return this.getInProgressPercent(req);
    }
    if (req.status === 'Acceptée') {
      return this.getProbableArrival(req) ? 35 : 20;
    }
    return 0;
  }

  getProgressLabel(req: DeliveryRequest): string {
    if (req.status === 'Livrée') {
      return 'Mission completed';
    }
    if (req.status === 'En cours') {
      return 'Mission in progress';
    }
    return this.getProbableArrival(req)
      ? 'Estimated arrival from the schedule'
      : 'Planned mission';
  }

  getProbableArrival(req: DeliveryRequest): string | null {
    const rawValue = this.probableArrivalByDeliveryId[req.id];
    return rawValue ? this.formatDateTime(rawValue) : null;
  }

  hasAnyRequest(): boolean {
    return this.sections.some((section) => section.requests.length > 0);
  }

  getPagedRequests(section: DeliveryHistorySection): DeliveryRequest[] {
    const page = this.sectionPageByKey[section.key] || 1;
    const start = (page - 1) * this.sectionPageSize;
    return section.requests.slice(start, start + this.sectionPageSize);
  }

  getSectionCurrentPage(sectionKey: DeliveryHistorySection['key']): number {
    return this.sectionPageByKey[sectionKey] || 1;
  }

  getSectionPageCount(section: DeliveryHistorySection): number {
    return Math.max(1, Math.ceil(section.requests.length / this.sectionPageSize));
  }

  canGoPrev(sectionKey: DeliveryHistorySection['key']): boolean {
    return this.getSectionCurrentPage(sectionKey) > 1;
  }

  canGoNext(section: DeliveryHistorySection): boolean {
    return this.getSectionCurrentPage(section.key) < this.getSectionPageCount(section);
  }

  goPrev(sectionKey: DeliveryHistorySection['key']): void {
    if (!this.canGoPrev(sectionKey)) {
      return;
    }
    this.sectionPageByKey[sectionKey] = this.getSectionCurrentPage(sectionKey) - 1;
  }

  goNext(section: DeliveryHistorySection): void {
    if (!this.canGoNext(section)) {
      return;
    }
    this.sectionPageByKey[section.key] = this.getSectionCurrentPage(section.key) + 1;
  }

  private buildSections(requests: DeliveryRequest[]): DeliveryHistorySection[] {
    return [
      {
        key: 'inProgress',
        title: 'In progress',
        subtitle: 'Active missions to monitor as a priority',
        icon: 'fa-truck-fast',
        requests: requests.filter((req) => req.status === 'En cours')
      },
      {
        key: 'accepted',
        title: 'Accepted',
        subtitle: 'Confirmed trips, ready for departure',
        icon: 'fa-calendar-check',
        requests: requests.filter((req) => req.status === 'Acceptée')
      },
      {
        key: 'delivered',
        title: 'Delivered',
        subtitle: 'Completed missions with useful archive',
        icon: 'fa-circle-check',
        requests: requests.filter((req) => req.status === 'Livrée')
      }
    ];
  }

  private syncSectionPages(): void {
    this.sections.forEach((section) => {
      const maxPage = this.getSectionPageCount(section);
      const currentPage = this.getSectionCurrentPage(section.key);
      this.sectionPageByKey[section.key] = Math.min(Math.max(currentPage, 1), maxPage);
    });
  }

  private loadProbableArrivals(requests: DeliveryRequest[]): void {
    const plannedRequests = requests.filter((req) => req.status === 'Acceptée' || req.status === 'En cours');
    if (!plannedRequests.length) {
      this.probableArrivalByDeliveryId = {};
      return;
    }

    const transporterId = this.requestService.getCurrentUserId();
    const monthKeys = Array.from(new Set(
      plannedRequests
        .map((req) => this.resolvePlanningDate(req))
        .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()))
        .map((date) => `${date.getFullYear()}-${date.getMonth() + 1}`)
    ));

    if (!monthKeys.length) {
      this.probableArrivalByDeliveryId = {};
      return;
    }

    forkJoin(
      monthKeys.map((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        if (!year || !month) {
          return of([] as CalendarDay[]);
        }
        return this.extendedService.getTransporterCalendar(transporterId, year, month);
      })
    ).subscribe((calendarResponses) => {
      const nextMap: Record<string, string> = {};
      calendarResponses
        .flatMap((days) => days)
        .flatMap((day) => day.items || [])
        .forEach((item) => {
          const deliveryId = String(item.livraisonId || '');
          const probableArrival = this.combineDateAndTime(item.scheduledDateTime, item.estimatedEndTime);
          if (deliveryId && probableArrival) {
            nextMap[deliveryId] = probableArrival;
          }
        });
      this.probableArrivalByDeliveryId = nextMap;
    });
  }

  private resolvePlanningDate(req: DeliveryRequest): Date | null {
    const rawValue = req.plannedDeliveryDate || req.departureDate || req.createdAt;
    if (!rawValue) {
      return null;
    }
    const date = new Date(rawValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private combineDateAndTime(baseDateValue?: string, timeValue?: string): string | null {
    if (!baseDateValue || !timeValue) {
      return null;
    }

    if (timeValue.includes('T')) {
      return timeValue;
    }

    const baseDate = new Date(baseDateValue);
    if (Number.isNaN(baseDate.getTime())) {
      return null;
    }

    const [hours, minutes] = timeValue.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    baseDate.setHours(hours, minutes, 0, 0);
    return baseDate.toISOString();
  }

  private getInProgressPercent(req: DeliveryRequest): number {
    const planningDate = this.resolvePlanningDate(req);
    const probableArrival = this.probableArrivalByDeliveryId[req.id];
    if (!planningDate || !probableArrival) {
      return 65;
    }

    const arrivalDate = new Date(probableArrival);
    if (Number.isNaN(arrivalDate.getTime())) {
      return 65;
    }

    const totalDuration = arrivalDate.getTime() - planningDate.getTime();
    if (totalDuration <= 0) {
      return 70;
    }

    const elapsed = Date.now() - planningDate.getTime();
    const ratio = Math.max(0, Math.min(elapsed / totalDuration, 0.95));
    return Math.round(Math.max(40, ratio * 100));
  }

  private getDistanceKm(req: DeliveryRequest): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(req.dropoffLat - req.pickupLat);
    const dLng = this.toRadians(req.dropoffLng - req.pickupLng);
    const startLat = this.toRadians(req.pickupLat);
    const endLat = this.toRadians(req.dropoffLat);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number.isFinite(c) ? earthRadiusKm * c : 0;
  }

  private toRadians(value: number): number {
    return (Number(value || 0) * Math.PI) / 180;
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(Number(value || 0));
  }
}
