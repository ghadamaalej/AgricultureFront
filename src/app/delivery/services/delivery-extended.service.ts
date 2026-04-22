import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';

export interface NegotiationRange {
  livraisonId: number;
  prixBase: number;
  prixMin: number;
  prixMax: number;
  variationPourcent: number;
  statutActuel: string;
  enNegociation: boolean;
}

export interface NegotiationResult {
  livraison: any;
  negociationRange?: { min: number; max: number };
  message: string;
}

export interface DateTimeNegotiationPayload {
  actorId: number;
  prixPropose: number;
  proposedDateTime?: string | null;
}

export interface CalendarDay {
  date: string;
  jourSemaine: string;
  hasDeliveries: boolean;
  totalDeliveries: number;
  groupsCount?: number;
  enCours: number;
  acceptees: number;
  livrees: number;
  revenueJour: number;
  items: CalendarItem[];
  totalEstimatedMinutes?: number;
  totalServiceMinutes?: number;
  totalTransitionMinutes?: number;
  capacityMinutes?: number;
  remainingMinutes?: number;
  overlapCount?: number;
  overloadMinutes?: number;
  hasConflict?: boolean;
  projectedEndTime?: string;
  warningMessage?: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface CalendarItem {
  livraisonId: number;
  reference: string;
  status: string;
  icon: string;
  color: string;
  priority: number;
  adresseDepart: string;
  adresseArrivee: string;
  prix: number;
  typeProduit: string;
  scheduledDateTime?: string;
  estimatedStartTime?: string;
  estimatedEndTime?: string;
  estimatedPickupMinutes?: number;
  estimatedDriveMinutes?: number;
  estimatedDropoffMinutes?: number;
  transitionFromPreviousMinutes?: number;
  overlapMinutes?: number;
  estimatedTotalMinutes?: number;
  distanceKm?: number;
  grouped?: boolean;
  groupReference?: string;
}

export interface CalendarSummary {
  month: number;
  year: number;
  totalDays: number;
  daysWithDeliveries: number;
  totalDeliveries: number;
  totalEnCours: number;
  totalAcceptees: number;
  totalLivrees: number;
  totalRevenue: number;
  averageDeliveriesPerDay: number;
  completionRate: number;
  overloadedDays?: number;
}

export interface TransporterStats {
  total: number;
  inProgress: number;
  delivered: number;
  grouped: number;
  deliverySuccessRate: number;
  revenueDelivered: number;
  avgPricePerDelivery: number;
  totalDistanceKm: number;
  avgDistancePerDelivery: number;
  avgRating: number;
  ratedDeliveries: number;
  globalAvgRating?: number;
  globalRatedDeliveries?: number;
  monthlyDeliveries: { [key: string]: number };
  productTypes: { [key: string]: number };
}

export interface DeliveryGroup {
  groupReference: string;
  deliveriesCount: number;
  delivered: number;
  inProgress: number;
  completionRate: number;
  totalWeightKg: number;
  totalDistanceKm: number;
  priceBefore: number;
  priceAfter: number;
  savings: number;
  savingsPercentage: number;
  groupedAt: string;
  status: string;
  livraisonIds: number[];
  agriculteurs: number[];
}

export interface GroupDetails {
  groupReference: string;
  deliveries: any[];
  deliveriesCount: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  totalDistanceKm: number;
  statusCount: { [key: string]: number };
  groupedAt: string;
  routePoints?: GroupRoutePoint[];
}

export interface GroupRoutePoint {
  lat: number;
  lng: number;
  label: string;
  kind: 'start' | 'stop' | 'end';
}

export interface FarmerScheduleDay {
  date: string;
  jourSemaine: string;
  hasDeliveries: boolean;
  totalDeliveries: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface FarmerPlanningStats {
  totalDeliveries: number;
  plannedDeliveries: number;
  withTransporteur: number;
  delivered: number;
  planningRate: number;
  transportAssignmentRate: number;
  deliverySuccessRate: number;
  next30DaysPlanned: number;
}

export interface DeliveryNotification {
  id: number;
  fromUserId: number;
  toUserId: number;
  livraisonId: number;
  type: string;
  title: string;
  message: string;
  proposedPrice?: number;
  preferredDateTime?: string;
  proposedDateTime?: string;
  minAllowedPrice?: number;
  maxAllowedPrice?: number;
  status: string;
  createdAt: string;
  seen: boolean;
}

export interface NotificationCount {
  count: number;
  userId: number;
  hasUnread: boolean;
}

export interface NotificationDeleteResult {
  id: number;
  deleted: boolean;
  actorId: number;
  message: string;
}

export interface DeliveryDetails {
  livraison: any;
  prixSuggere: number;
  peutNegocier: boolean;
  enNegociation: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DeliveryExtendedService {
  private readonly apiBase = '/livraison/api/livraisons';

  constructor(private http: HttpClient) {}

  // Négociation avec barre +/-5%
  getNegociationRange(livraisonId: number): Observable<NegotiationRange> {
    return this.http.get<NegotiationRange>(`${this.apiBase}/${livraisonId}/negociation-range`).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération de la plage de négociation:', err);
        return of(null as any);
      })
    );
  }

  negocierAvecBarre(livraisonId: number, transporteurId: number, prixPropose: number, proposedDateTime?: string | null): Observable<NegotiationResult> {
    const normalizedDateTime = this.normalizeLocalDateTime(proposedDateTime);
    return this.http.post<NegotiationResult>(`${this.apiBase}/${livraisonId}/negocier-barre`, {
      actorId: transporteurId,
      prixPropose,
      proposedDateTime: normalizedDateTime
    } as DateTimeNegotiationPayload).pipe(
      catchError(err => {
        const message = this.extractApiErrorMessage(err, 'La négociation a échoué.');
        console.error('Erreur lors de la négociation:', message, err);
        return throwError(() => new Error(message));
      })
    );
  }

  accepterNegociationBarre(livraisonId: number, agriculteurId: number): Observable<NegotiationResult> {
    return this.http.post<NegotiationResult>(`${this.apiBase}/${livraisonId}/accepter-negociation-barre`, null, {
      params: new HttpParams().set('agriculteurId', String(agriculteurId))
    }).pipe(
      catchError(err => {
        console.error('Erreur lors de l\'acceptation de la négociation:', err);
        return of(null as any);
      })
    );
  }

  refuserNegociationBarre(livraisonId: number, agriculteurId: number): Observable<NegotiationResult> {
    return this.http.post<NegotiationResult>(`${this.apiBase}/${livraisonId}/refuser-negociation-barre`, null, {
      params: new HttpParams().set('agriculteurId', String(agriculteurId))
    }).pipe(
      catchError(err => {
        console.error('Erreur lors du refus de la négociation:', err);
        return of(null as any);
      })
    );
  }

  // Calendrier du transporteur
  getTransporterCalendar(transporteurId: number, year: number, month: number): Observable<CalendarDay[]> {
    return this.http.get<CalendarDay[]>(`${this.apiBase}/transporter/${transporteurId}/calendar`, {
      params: new HttpParams()
        .set('year', String(year))
        .set('month', String(month))
    }).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération du calendrier:', err);
        return of([]);
      })
    );
  }

  getTransporterCalendarSummary(transporteurId: number, year: number, month: number): Observable<CalendarSummary> {
    return this.http.get<CalendarSummary>(`${this.apiBase}/transporter/${transporteurId}/calendar-summary`, {
      params: new HttpParams()
        .set('year', String(year))
        .set('month', String(month))
    }).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération du résumé du calendrier:', err);
        return of(null as any);
      })
    );
  }

  // Statistiques du transporteur
  getTransporterStats(transporteurId: number): Observable<TransporterStats> {
    return this.http.get<TransporterStats>(`${this.apiBase}/transporter/${transporteurId}/stats`).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération des statistiques:', err);
        return of(null as any);
      })
    );
  }

  getTransporterAdvancedStats(transporteurId: number, periodMonths: number = 6): Observable<any> {
    return this.http.get<any>(`${this.apiBase}/transporter/${transporteurId}/advanced-stats`, {
      params: new HttpParams().set('periodMonths', String(periodMonths))
    }).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération des statistiques avancées:', err);
        return of(null as any);
      })
    );
  }

  // Gestion des groupes
  getTransporterGroups(transporteurId: number): Observable<DeliveryGroup[]> {
    return this.http.get<DeliveryGroup[]>(`${this.apiBase}/transporter/${transporteurId}/groups`).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération des groupes:', err);
        return of([]);
      })
    );
  }

  getGroupDetails(groupReference: string, transporteurId: number): Observable<GroupDetails> {
    return this.http.get<GroupDetails>(`${this.apiBase}/transporter/${transporteurId}/groups/${groupReference}`).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération des détails du groupe:', err);
        return of(null as any);
      })
    );
  }

  createGroupFromDeliveries(transporteurId: number, livraisonIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/transporter/${transporteurId}/create-group`, livraisonIds).pipe(
      catchError(err => {
        console.error('Erreur lors de la création du groupe:', err);
        return of(null as any);
      })
    );
  }

  updateGroupDeliveries(transporteurId: number, groupReference: string, livraisonIds: number[]): Observable<any> {
    return this.http.put<any>(`${this.apiBase}/transporter/${transporteurId}/groups/${groupReference}`, livraisonIds).pipe(
      catchError(err => {
        console.error('Erreur lors de la mise à jour du groupe:', err);
        return of(null as any);
      })
    );
  }

  deleteGroup(transporteurId: number, groupReference: string): Observable<any> {
    return this.http.delete<any>(`${this.apiBase}/transporter/${transporteurId}/groups/${groupReference}`).pipe(
      catchError(err => {
        console.error('Erreur lors de la suppression du groupe:', err);
        return of(null as any);
      })
    );
  }

  // Planification par l'agriculteur
  scheduleDeliveryDate(livraisonId: number, agriculteurId: number, dateLivraisonPrevue: string): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/${livraisonId}/planifier`, {
      agriculteurId: agriculteurId,
      dateLivraisonPrevue: dateLivraisonPrevue
    }).pipe(
      catchError(err => {
        console.error('Erreur lors de la planification de la livraison:', err);
        return of(null as any);
      })
    );
  }

  getAgriculteurSchedule(agriculteurId: number, year: number, month: number): Observable<FarmerScheduleDay[]> {
    return this.http.get<FarmerScheduleDay[]>(`${this.apiBase}/agriculteur/${agriculteurId}/schedule`, {
      params: new HttpParams()
        .set('year', String(year))
        .set('month', String(month))
    }).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération du calendrier agriculteur:', err);
        return of([]);
      })
    );
  }

  getAgriculteurPlanningStats(agriculteurId: number): Observable<FarmerPlanningStats> {
    return this.http.get<FarmerPlanningStats>(`${this.apiBase}/agriculteur/${agriculteurId}/planning-stats`).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération des statistiques de planification:', err);
        return of(null as any);
      })
    );
  }

  // Demandes en cours pour transporteur
  getDemandesEnCoursPourTransporteur(transporteurId: number, status?: string): Observable<any[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<any[]>(`${this.apiBase}/transporteur/${transporteurId}/demandes-en-cours`, { params }).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération des demandes en cours:', err);
        return of([]);
      })
    );
  }

  getDetailsPourTransporteur(livraisonId: number, transporteurId: number): Observable<DeliveryDetails> {
    return this.http.get<DeliveryDetails>(`${this.apiBase}/${livraisonId}/details-transporteur`, {
      params: new HttpParams().set('transporteurId', String(transporteurId))
    }).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération des détails pour transporteur:', err);
        return of(null as any);
      })
    );
  }

  // Notifications
  getNotificationsForUser(userId: number): Observable<DeliveryNotification[]> {
    return this.http.get<any[]>(`${this.apiBase}/notifications/${userId}`).pipe(
      map((items) => items.map((item) => this.normalizeNotification(item))),
      catchError(err => {
        console.error('Erreur lors de la récupération des notifications:', err);
        return of([]);
      })
    );
  }

  getUnreadNotificationsCount(userId: number): Observable<NotificationCount> {
    return this.http.get<NotificationCount>(`${this.apiBase}/notifications/${userId}/count`).pipe(
      catchError(err => {
        console.error('Erreur lors de la récupération du nombre de notifications non lues:', err);
        return of({ count: 0, userId, hasUnread: false });
      })
    );
  }

  markNotificationAsRead(notificationId: number): Observable<DeliveryNotification> {
    return this.http.put<any>(`${this.apiBase}/notifications/${notificationId}/mark-read`, null).pipe(
      map((item) => this.normalizeNotification(item)),
      catchError(err => {
        console.error('Erreur lors du marquage de la notification comme lue:', err);
        return of(null as any);
      })
    );
  }

  markAllNotificationsAsRead(userId: number): Observable<any> {
    return this.http.put<any>(`${this.apiBase}/notifications/${userId}/mark-all-read`, null).pipe(
      catchError(err => {
        console.error('Erreur lors du marquage de toutes les notifications comme lues:', err);
        return of({ markedCount: 0, userId, totalNotifications: 0 });
      })
    );
  }

  deleteNotification(notificationId: number, actorId: number): Observable<NotificationDeleteResult> {
    return this.http.delete<NotificationDeleteResult>(`${this.apiBase}/notifications/${notificationId}`, {
      params: new HttpParams().set('actorId', String(actorId))
    }).pipe(
      catchError(err => {
        const message = this.extractApiErrorMessage(err, 'La suppression de la notification a échoué.');
        console.error('Erreur lors de la suppression de la notification:', message, err);
        return throwError(() => new Error(message));
      })
    );
  }

  getPendingNegotiationNotifications(userId: number): Observable<DeliveryNotification[]> {
    return this.http.get<any[]>(`${this.apiBase}/notifications/${userId}/negociation-pending`).pipe(
      map((items) => items.map((item) => this.normalizeNotification(item))),
      catchError(err => {
        console.error('Erreur lors de la récupération des notifications de négociation en attente:', err);
        return of([]);
      })
    );
  }

  handleNotificationAction(notificationId: number, actorId: number, action: string, counterPrice?: number, counterDateTime?: string | null): Observable<DeliveryNotification> {
    const backendAction = action === 'COUNTER_PROPOSE' ? 'COUNTER' : action;
    const normalizedDateTime = this.normalizeLocalDateTime(counterDateTime);
    let params = new HttpParams()
      .set('actorId', String(actorId))
      .set('action', backendAction);
    if (counterPrice !== undefined) {
      params = params.set('counterPrice', String(counterPrice));
    }
    if (normalizedDateTime) {
      params = params.set('counterDateTime', normalizedDateTime);
    }
    return this.http.put<any>(`${this.apiBase}/notifications/${notificationId}/action`, null, { params }).pipe(
      map((item) => this.normalizeNotification(item)),
      catchError(err => {
        const message = this.extractApiErrorMessage(err, 'Le traitement de la notification a échoué.');
        console.error('Erreur lors du traitement de l\'action de notification:', message, err);
        return throwError(() => new Error(message));
      })
    );
  }

  private normalizeNotification(item: any): DeliveryNotification {
    return {
      id: Number(item?.id ?? item?.livraisonId ?? 0),
      fromUserId: Number(item?.fromUserId ?? item?.notificationFromUserId ?? 0),
      toUserId: Number(item?.toUserId ?? item?.notificationToUserId ?? 0),
      livraisonId: Number(item?.livraisonId ?? item?.id ?? 0),
      type: item?.type ?? item?.notificationType ?? 'SYSTEM_NOTIFICATION',
      title: item?.title ?? item?.notificationTitle ?? 'Notification',
      message: item?.message ?? item?.notificationMessage ?? '',
      proposedPrice: item?.proposedPrice ?? item?.prixNegocie,
      preferredDateTime: item?.preferredDateTime ?? item?.datePreferenceAgriculteur,
      proposedDateTime: item?.proposedDateTime ?? item?.dateProposeeNegociation,
      minAllowedPrice: item?.minAllowedPrice,
      maxAllowedPrice: item?.maxAllowedPrice,
      status: item?.status ?? item?.notificationStatus ?? 'PENDING',
      createdAt: item?.createdAt ?? item?.notificationCreatedAt ?? new Date().toISOString(),
      seen: Boolean(item?.seen ?? item?.notificationSeen)
    };
  }

  private normalizeLocalDateTime(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    const seconds = String(parsed.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  private extractApiErrorMessage(error: any, fallback: string): string {
    const backendMessage = error?.error?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage.trim();
    }

    const validationErrors = error?.error?.errors;
    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      return String(validationErrors[0]);
    }

    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    return fallback;
  }
}
