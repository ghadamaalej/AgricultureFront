import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryExtendedService, DeliveryNotification, NotificationCount } from '../../services/delivery-extended.service';
import { DeliveryRequestService } from '../../services/delivery-request.service';
import { getDeliveryUserRole } from '../../services/delivery-auth.helper';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  @Input() userId: number = 0;
  @Input() showUnreadOnly: boolean = false;
  @Output() notificationAction = new EventEmitter<any>();
  @Output() deliverySelected = new EventEmitter<number>();

  notifications: DeliveryNotification[] = [];
  unreadCount: number = 0;
  isLoading: boolean = false;
  showNotificationsPanel: boolean = false;
  selectedNotification: DeliveryNotification | null = null;
  processingNotificationIds = new Set<number>();
  processingBulkRead = false;
  actionFeedback: { type: 'success' | 'error'; message: string } | null = null;

  // Pour la contre-proposition
  counterPrice: number = 0;
  counterDateTime: string = '';
  private readonly groupedNotifReadStoragePrefix = 'deliveryGroupedNotifRead:';
  private groupedNotifReadIds = new Set<number>();

  // Filtres
  filterType: string = 'all'; // all, PRICE_NEGOTIATION_BAR, DELIVERY_UPDATE, etc.
  filterStatus: string = 'all'; // all, PENDING, ACCEPTED, REJECTED, COUNTERED

  constructor(
    private deliveryService: DeliveryExtendedService,
    private requestService: DeliveryRequestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadGroupedReadIds();
    this.loadNotifications();
    this.loadUnreadCount();
    
    // Auto-refresh toutes les 30 secondes
    setInterval(() => {
      this.loadUnreadCount();
    }, 30000);
  }

  loadNotifications(): void {
    if (!this.userId) return;
    
    this.isLoading = true;
    
    let serviceCall = this.deliveryService.getNotificationsForUser(this.userId);
    
    if (this.filterType === 'negociation') {
      serviceCall = this.deliveryService.getPendingNegotiationNotifications(this.userId);
    }
    
    serviceCall.subscribe({
      next: (notifications) => {
        this.notifications = this.applyFilters([
          ...notifications,
          ...this.getUpcomingReminderNotifications(),
          ...this.getFarmerGroupedSavingsNotifications()
        ]);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des notifications:', err);
        this.isLoading = false;
      }
    });
  }

  loadUnreadCount(): void {
    if (!this.userId) return;
    
    this.deliveryService.getUnreadNotificationsCount(this.userId).subscribe({
      next: (count) => {
        this.unreadCount = count.count
          + this.getUpcomingReminderNotifications().filter((notification) => !notification.seen).length
          + this.getFarmerGroupedSavingsNotifications().filter((notification) => !notification.seen).length;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du nombre de notifications non lues:', err);
      }
    });
  }

  applyFilters(notifications: DeliveryNotification[]): DeliveryNotification[] {
    let filtered = notifications;
    
    // Filtrer par type
    if (this.filterType !== 'all' && this.filterType !== 'negociation') {
      filtered = filtered.filter(n => n.type === this.filterType);
    }
    
    // Filtrer par statut
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(n => n.status === this.filterStatus);
    }
    
    // Filtrer par lecture si demandé
    if (this.showUnreadOnly) {
      filtered = filtered.filter(n => !n.seen);
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  toggleNotificationsPanel(): void {
    this.showNotificationsPanel = !this.showNotificationsPanel;
    if (this.showNotificationsPanel) {
      this.loadNotifications();
    }
  }

  selectNotification(notification: DeliveryNotification): void {
    this.selectedNotification = notification;
    if (this.isNegotiationNotification(notification) && this.canActOnNotification(notification)) {
      this.initializeCounterProposal(notification);
    }

    // Marquer comme lue si elle ne l'est pas
    if (!notification.seen && notification.id > 0) {
      this.markAsRead(notification.id);
    }
  }

  markAsRead(notificationId: number, event?: Event): void {
    event?.stopPropagation();
    if (notificationId < 0) {
      this.markGroupedNotificationAsRead(notificationId);
      const notification = this.notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.seen = true;
      }
      this.loadUnreadCount();
      return;
    }

    if (this.processingNotificationIds.has(notificationId)) {
      return;
    }
    this.processingNotificationIds.add(notificationId);
    this.deliveryService.markNotificationAsRead(notificationId).subscribe({
      next: () => {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.seen = true;
        }
        this.loadUnreadCount();
        this.processingNotificationIds.delete(notificationId);
      },
      error: (err) => {
        console.error('Erreur lors du marquage de la notification comme lue:', err);
        this.processingNotificationIds.delete(notificationId);
      }
    });
  }

  markAllAsRead(event?: Event): void {
    event?.stopPropagation();
    if (this.processingBulkRead || !this.userId) {
      return;
    }
    this.processingBulkRead = true;
    this.deliveryService.markAllNotificationsAsRead(this.userId).subscribe({
      next: () => {
        this.notifications.forEach(n => n.seen = true);
        this.unreadCount = 0;
        this.processingBulkRead = false;
      },
      error: (err) => {
        console.error('Erreur lors du marquage de toutes les notifications comme lues:', err);
        this.processingBulkRead = false;
      }
    });
  }

  handleNotificationAction(notification: DeliveryNotification, action: string, counterPrice?: number, counterDateTime?: string | null, event?: Event): void {
    event?.stopPropagation();
    if (this.processingNotificationIds.has(notification.id)) {
      return;
    }
    this.processingNotificationIds.add(notification.id);
    this.deliveryService.handleNotificationAction(notification.id, this.userId, action, counterPrice, counterDateTime).subscribe({
      next: (updatedNotification) => {
        // Mettre à jour la notification dans la liste
        const index = this.notifications.findIndex(n => n.id === notification.id);
        if (index > -1) {
          this.notifications[index] = updatedNotification;
        }
        
        this.notificationAction.emit({
          notification: updatedNotification,
          action: action
        });

        this.requestService.refreshFromBackend().subscribe(() => {
          this.loadNotifications();
          this.loadUnreadCount();
          this.processingNotificationIds.delete(notification.id);
        });
      },
      error: (err) => {
        console.error('Erreur lors du traitement de l\'action de notification:', err);
        this.processingNotificationIds.delete(notification.id);
      }
    });
  }

  acceptNegotiation(notification: DeliveryNotification, event?: Event): void {
    this.handleNegotiationDecision(notification, 'ACCEPT', event);
  }

  rejectNegotiation(notification: DeliveryNotification, event?: Event): void {
    this.handleNegotiationDecision(notification, 'REJECT', event);
  }

  private handleNegotiationDecision(notification: DeliveryNotification, action: 'ACCEPT' | 'REJECT', event?: Event): void {
    event?.stopPropagation();
    if (this.processingNotificationIds.has(notification.id)) {
      return;
    }
    this.processingNotificationIds.add(notification.id);

    this.deliveryService.handleNotificationAction(notification.id, this.userId, action).subscribe({
      next: (updated) => {
        if (!updated) {
          const fallback = action === 'ACCEPT'
            ? 'Acceptance not possible at the moment.'
            : 'Rejection not possible at the moment.';
          this.pushFeedback('error', fallback);
          this.processingNotificationIds.delete(notification.id);
          return;
        }

        this.pushFeedback(
          'success',
          action === 'ACCEPT' ? 'Negotiation accepted successfully.' : 'Negotiation rejected.'
        );
        this.selectedNotification = null;
        this.requestService.refreshFromBackend().subscribe(() => {
          this.loadNotifications();
          this.loadUnreadCount();
          this.processingNotificationIds.delete(notification.id);
        });
      },
      error: (err) => {
        const fallback = action === 'ACCEPT'
          ? 'Error accepting the negotiation.'
          : 'Error rejecting the negotiation.';
        this.pushFeedback('error', this.extractErrorMessage(err, fallback));
        this.processingNotificationIds.delete(notification.id);
      }
    });
  }

  counterNegotiation(notification: DeliveryNotification, counterPrice: number, counterDateTime?: string | null, event?: Event): void {
    const min = this.getCounterMin(notification);
    const max = this.getCounterMax(notification);
    const safePrice = this.clampCounterPrice(counterPrice, min, max);
    this.counterPrice = safePrice;
    this.handleNotificationAction(notification, 'COUNTER_PROPOSE', safePrice, counterDateTime, event);
  }

  openCounterProposal(notification: DeliveryNotification, event?: Event): void {
    event?.stopPropagation();
    this.selectedNotification = notification;
    this.initializeCounterProposal(notification);
  }

  hasCounterRange(notification: DeliveryNotification | null): boolean {
    if (!notification) {
      return false;
    }
    return this.getCounterMax(notification) > this.getCounterMin(notification);
  }

  getCounterMin(notification: DeliveryNotification): number {
    const fallback = Number(notification.proposedPrice || 0) * 0.95;
    const raw = Number(notification.minAllowedPrice ?? fallback);
    return Number.isFinite(raw) ? raw : 0;
  }

  getCounterMax(notification: DeliveryNotification): number {
    const fallback = Number(notification.proposedPrice || 0) * 1.05;
    const raw = Number(notification.maxAllowedPrice ?? fallback);
    return Number.isFinite(raw) ? raw : 0;
  }

  onCounterSliderInput(notification: DeliveryNotification): void {
    this.counterPrice = this.clampCounterPrice(this.counterPrice, this.getCounterMin(notification), this.getCounterMax(notification));
  }

  private initializeCounterProposal(notification: DeliveryNotification): void {
    const min = this.getCounterMin(notification);
    const max = this.getCounterMax(notification);
    const proposed = Number(notification.proposedPrice || 0);
    this.counterPrice = this.clampCounterPrice(proposed || min, min, max);
    this.counterDateTime = notification.proposedDateTime || notification.preferredDateTime || '';
  }

  private clampCounterPrice(value: number, min: number, max: number): number {
    const safe = Number.isFinite(value) ? value : min;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.min(high, Math.max(low, safe));
  }

  viewDelivery(livraisonId: number, event?: Event, notification?: DeliveryNotification): void {
    event?.stopPropagation();
    this.showNotificationsPanel = false;
    if (notification?.type === 'DELIVERY_SIGNATURE_REQUIRED') {
      this.router.navigate(['/delivery/livraisons', livraisonId]);
      return;
    }
    this.deliverySelected.emit(livraisonId);
  }

  deleteNotification(notificationId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.processingNotificationIds.has(notificationId)) {
      return;
    }
    if (notificationId < 0) {
      this.markGroupedNotificationAsRead(notificationId);
      this.notifications = this.notifications.filter((notification) => notification.id !== notificationId);
      this.unreadCount = Math.max(this.unreadCount - 1, 0);
      if (this.selectedNotification?.id === notificationId) {
        this.selectedNotification = null;
      }
      return;
    }

    this.processingNotificationIds.add(notificationId);
    this.deliveryService.deleteNotification(notificationId, this.userId).subscribe({
      next: () => {
        const deleted = this.notifications.find((notification) => notification.id === notificationId);
        const wasUnread = deleted ? !deleted.seen : false;
        this.notifications = this.notifications.filter((notification) => notification.id !== notificationId);
        if (wasUnread) {
          this.unreadCount = Math.max(this.unreadCount - 1, 0);
        }
        if (this.selectedNotification?.id === notificationId) {
          this.selectedNotification = null;
        }
        this.processingNotificationIds.delete(notificationId);
      },
      error: (err) => {
        console.error('Erreur lors de la suppression de la notification:', err);
        this.processingNotificationIds.delete(notificationId);
      }
    });
  }

  onFilterChange(): void {
    this.loadNotifications();
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(price);
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return 'Not specified';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getNotificationIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'PRICE_NEGOTIATION_BAR': 'handshake',
      'DELIVERY_UPDATE': 'truck',
      'DELIVERY_IN_TRANSIT': 'route',
      'DELIVERY_ASSIGNED': 'check-circle',
      'DELIVERY_TARGETED_REQUEST': 'user-check',
      'DELIVERY_REMINDER': 'clock',
      'DELIVERY_COMPLETED': 'check-double',
      'DELIVERY_SIGNATURE_REQUIRED': 'pen-nib',
      'DELIVERY_CANCELLED': 'times-circle',
      'PAYMENT_PROCESSED': 'credit-card',
      'SYSTEM_NOTIFICATION': 'bell'
    };
    return icons[type] || 'bell';
  }

  getNotificationColor(type: string): string {
    const colors: { [key: string]: string } = {
      'PRICE_NEGOTIATION_BAR': '#f59e0b',
      'DELIVERY_UPDATE': '#3b82f6',
      'DELIVERY_IN_TRANSIT': '#2563eb',
      'DELIVERY_ASSIGNED': '#10b981',
      'DELIVERY_TARGETED_REQUEST': '#14b8a6',
      'DELIVERY_REMINDER': '#f59e0b',
      'DELIVERY_COMPLETED': '#10b981',
      'DELIVERY_SIGNATURE_REQUIRED': '#7c3aed',
      'DELIVERY_CANCELLED': '#ef4444',
      'PAYMENT_PROCESSED': '#8b5cf6',
      'SYSTEM_NOTIFICATION': '#6b7280'
    };
    return colors[type] || '#6b7280';
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'PENDING': '#f59e0b',
      'ACCEPTED': '#10b981',
      'REJECTED': '#ef4444',
      'COUNTERED': '#3b82f6'
    };
    return colors[status] || '#6b7280';
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'PENDING': 'Pending',
      'ACCEPTED': 'Accepted',
      'REJECTED': 'Rejected',
      'COUNTERED': 'Counter-proposal'
    };
    return texts[status] || status;
  }

  isNegotiationNotification(notification: DeliveryNotification): boolean {
    return notification.type === 'PRICE_NEGOTIATION_BAR' && 
           ['PENDING', 'COUNTERED'].includes(notification.status);
  }

  canActOnNotification(notification: DeliveryNotification): boolean {
    return this.isNegotiationNotification(notification) && 
           notification.toUserId === this.userId;
  }

  isProcessing(notificationId: number): boolean {
    return this.processingNotificationIds.has(notificationId);
  }

  private pushFeedback(type: 'success' | 'error', message: string): void {
    this.actionFeedback = { type, message };
    window.setTimeout(() => {
      this.actionFeedback = null;
    }, 4000);
  }

  private extractErrorMessage(err: any, fallback: string): string {
    const message = err?.error?.message || err?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
    return fallback;
  }

  private getUpcomingReminderNotifications(): DeliveryNotification[] {
    const role = getDeliveryUserRole();
    const isTransporter = role.includes('transport') || role.includes('livreur');
    if (!isTransporter || !this.userId) {
      return [];
    }

    return this.requestService.getTransporterActiveRequests()
      .map((delivery, index) => {
        const targetDate = delivery.plannedDeliveryDate || delivery.departureDate;
        if (!targetDate) {
          return null;
        }
        const plannedDate = new Date(targetDate);
        const diffMinutes = Math.round((plannedDate.getTime() - Date.now()) / 60000);
        if (Number.isNaN(plannedDate.getTime()) || diffMinutes < 0 || diffMinutes > 60) {
          return null;
        }
        return {
          id: -1 * (index + 1),
          fromUserId: 0,
          toUserId: this.userId,
          livraisonId: Number(delivery.id),
          type: 'DELIVERY_REMINDER',
          title: 'Imminent delivery reminder',
          message: `Delivery ${delivery.reference} is approaching. Planned departure in ${diffMinutes} min.`,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          seen: false,
          preferredDateTime: targetDate
        } as DeliveryNotification;
      })
      .filter((notification): notification is DeliveryNotification => Boolean(notification));
  }

  private getFarmerGroupedSavingsNotifications(): DeliveryNotification[] {
    const role = getDeliveryUserRole();
    const isFarmer = role.includes('agric') || role.includes('farmer');
    if (!isFarmer || !this.userId) {
      return [];
    }

    return this.requestService.getForCurrentFarmer()
      .filter((delivery) => Boolean(delivery.grouped && delivery.groupReference))
      .map((delivery) => {
        const numericId = Number(delivery.id.replace(/\D/g, '')) || 0;
        const syntheticId = -200000 - numericId;
        const estimatedBefore = this.round2(Number(delivery.estimatedPrice || 0) / 0.75);
        const saved = this.round2(estimatedBefore - Number(delivery.estimatedPrice || 0));
        return {
          id: syntheticId,
          fromUserId: 0,
          toUserId: this.userId,
          livraisonId: Number(delivery.id) || numericId,
          type: 'DELIVERY_GROUPED',
          title: 'Grouped request',
          message: `Your request ${delivery.reference} has been grouped. Estimated saving: ${saved.toFixed(2)} TND.`,
          status: 'ACCEPTED',
          createdAt: delivery.createdAt || new Date().toISOString(),
          seen: this.groupedNotifReadIds.has(syntheticId)
        } as DeliveryNotification;
      });
  }

  private loadGroupedReadIds(): void {
    if (!this.userId) {
      this.groupedNotifReadIds = new Set<number>();
      return;
    }

    try {
      const raw = localStorage.getItem(this.groupedReadStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
      this.groupedNotifReadIds = new Set<number>(ids);
    } catch {
      this.groupedNotifReadIds = new Set<number>();
    }
  }

  private markGroupedNotificationAsRead(notificationId: number): void {
    this.groupedNotifReadIds.add(notificationId);
    localStorage.setItem(this.groupedReadStorageKey(), JSON.stringify(Array.from(this.groupedNotifReadIds)));
  }

  private groupedReadStorageKey(): string {
    return `${this.groupedNotifReadStoragePrefix}${this.userId}`;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
