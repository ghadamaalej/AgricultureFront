import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { getDeliveryUserEmail, getDeliveryUserId, getDeliveryUserRole } from './delivery-auth.helper';

export type DeliveryRequestStatus = 'En attente' | 'Acceptée' | 'En cours' | 'Livrée' | 'Refusée';

export type DeliveryRequest = {
  id: string;
  reference: string;
  product: string;
  weightKg: number;
  details: string;
  pickupLabel: string;
  dropoffLabel: string;
  estimatedPrice: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  autoGrouping: boolean;
  status: DeliveryRequestStatus;
  createdByRole: 'Agriculteur' | 'Transporteur';
  createdByEmail: string;
  createdById?: number;
  acceptedByEmail?: string;
  acceptedById?: number;
  createdAt: string;
  departureDate?: string;
  plannedDeliveryDate?: string;
  deliveredAt?: string;
  grouped?: boolean;
  groupReference?: string;
  rating?: number;
  ratingStatus?: 'PENDING' | 'RATED' | 'IGNORED';
  currentLat?: number;
  currentLng?: number;
  signatureStatus?: string;
};

export type DeliveryRequestInput = {
  reference: string;
  product: string;
  weightKg: number;
  details: string;
  departureDate?: string;
  pickupLabel: string;
  dropoffLabel: string;
  estimatedPrice: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  autoGrouping: boolean;
};

export type FarmerKnownTransporter = {
  transporteurId: number;
  displayName: string;
  completedDeliveries: number;
  lastDeliveryAt?: string;
};

export type TargetedCreateResult = {
  delivery: DeliveryRequest | null;
  errorMessage?: string;
};

export type DeliveryPriceEstimate = {
  estimatedPrice: number;
  distanceKm: number;
  durationHours: number;
  weatherSurchargePercent: number;
  weatherCondition: string;
};

export type LivraisonApi = {
  id: number;
  reference: string;
  type?: string;
  status?: string;
  statusDemande?: string;
  agriculteurId: number;
  transporteurId: number;
  dateCreation?: string;
  dateDepart?: string;
  datePreferenceAgriculteur?: string;
  dateProposeeNegociation?: string;
  dateLivraisonPrevue?: string;
  dateLivraisonEffective?: string;
  adresseDepart?: string;
  adresseArrivee?: string;
  latDepart?: number;
  lngDepart?: number;
  latArrivee?: number;
  lngArrivee?: number;
  latActuelle?: number;
  lngActuelle?: number;
  poids?: number;
  volume?: number;
  typeProduit?: string;
  detailsDemande?: string;
  estRegroupable?: boolean;
  prix?: number;
  note?: number;
  ratingStatus?: string;
  grouped?: boolean;
  groupReference?: string;
  signatureStatus?: string;
  signatureData?: string;
  signedAt?: string;
};

export type AcceptTransporterResult = {
  success: boolean;
  delivery?: LivraisonApi | null;
  errorMessage?: string;
};

export type DeliveryAdminKpis = {
  total: number;
  enAttente: number;
  acceptees: number;
  enCours: number;
  livre: number;
  annulees: number;
  revenue: number;
  avgPrice: number;
  tauxLivraison: number;
};

@Injectable()
export class DeliveryRequestService {
  private readonly storageKey = 'deliveryRequests';
  private readonly usersDirectoryKey = 'deliveryKnownUsers';
  private readonly apiBase = '/livraison/api/livraisons';

  constructor(private http: HttpClient) {
    this.captureCurrentUserIdentity();
  }

  getCurrentUserEmail(): string {
    return getDeliveryUserEmail();
  }

  getCurrentUserId(): number {
    return getDeliveryUserId() ?? 0;
  }

  getAdminKpis(): Observable<DeliveryAdminKpis> {
    return this.http.get<Record<string, unknown>>(`${this.apiBase}/admin/kpis`).pipe(
      map((payload) => this.normalizeAdminKpis(payload)),
      catchError((err) => {
        console.warn('Load admin KPIs failed, using computed fallback.', err);
        return of(this.emptyAdminKpis());
      })
    );
  }

  refreshFromBackend(): Observable<DeliveryRequest[]> {
    let params = new HttpParams();
    if (this.isFarmerRole()) {
      params = params.set('agriculteurId', String(this.getCurrentUserId()));
    }

    return this.http.get<LivraisonApi[]>(this.apiBase, { params }).pipe(
      map((items) => items.map((x) => this.fromApi(x))),
      tap((mapped) => this.writeToStorage(mapped)),
      catchError((err) => {
        console.warn('Delivery refresh failed, clearing local cache to avoid stale UI.', err);
        this.writeToStorage([]);
        return of([]);
      })
    );
  }

  getApiById(requestId: string): Observable<LivraisonApi | null> {
    const numericId = this.toNumericId(requestId);
    if (!numericId) {
      return of(null);
    }

    return this.http.get<LivraisonApi>(`${this.apiBase}/${numericId}`).pipe(
      tap((api) => this.upsertFromApi(api)),
      catchError((err) => {
        console.warn('Load livraison by id failed.', err);
        return of(null);
      })
    );
  }

  createApiDelivery(payload: Partial<LivraisonApi>): Observable<LivraisonApi | null> {
    return this.http.post<LivraisonApi>(this.apiBase, payload).pipe(
      tap((saved) => this.upsertFromApi(saved)),
      catchError((err) => {
        console.warn('Create livraison failed.', err);
        return of(null);
      })
    );
  }

  updateApiDelivery(requestId: string, payload: Partial<LivraisonApi>): Observable<LivraisonApi | null> {
    const numericId = this.toNumericId(requestId);
    if (!numericId) {
      return of(null);
    }

    return this.http.put<LivraisonApi>(`${this.apiBase}/${numericId}`, payload).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      catchError((err) => {
        console.warn('Update livraison failed.', err);
        return of(null);
      })
    );
  }

  deleteApiDelivery(requestId: string): Observable<boolean> {
    const numericId = this.toNumericId(requestId);
    if (!numericId) {
      return of(false);
    }

    return this.http.delete<void>(`${this.apiBase}/${numericId}`).pipe(
      tap(() => this.removeFromStorage(String(numericId))),
      map(() => true),
      catchError((err) => {
        console.warn('Delete livraison failed.', err);
        return of(false);
      })
    );
  }

  assignTransporteur(requestId: string, transporteurId: number): Observable<LivraisonApi | null> {
    const numericId = this.toNumericId(requestId);
    if (!numericId || !transporteurId) {
      return of(null);
    }

    return this.http.put<LivraisonApi>(`${this.apiBase}/${numericId}/assign`, null, {
      params: new HttpParams().set('transporteurId', String(transporteurId))
    }).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      catchError((err) => {
        console.warn('Assign transporteur failed.', err);
        return of(null);
      })
    );
  }

  updateCurrentPosition(requestId: string, lat: number, lng: number): Observable<LivraisonApi | null> {
    const numericId = this.toNumericId(requestId);
    if (!numericId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return of(null);
    }

    return this.http.put<LivraisonApi>(`${this.apiBase}/${numericId}/gps`, null, {
      params: new HttpParams()
        .set('lat', String(lat))
        .set('lng', String(lng))
    }).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      catchError((err) => {
        console.warn('Update GPS failed.', err);
        return of(null);
      })
    );
  }

  evaluerTransporteur(requestId: string, note: number, evaluateurId?: number): Observable<LivraisonApi | null> {
    const numericId = this.toNumericId(requestId);
    if (!numericId || !Number.isFinite(note)) {
      return of(null);
    }

    let params = new HttpParams().set('note', String(note));
    if (evaluateurId) {
      params = params.set('evaluateurId', String(evaluateurId));
    }

    return this.http.put<LivraisonApi>(`${this.apiBase}/${numericId}/note`, null, { params }).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      catchError((err) => {
        console.warn('Evaluation transporteur failed.', err);
        return of(null);
      })
    );
  }

  saveSignature(livraisonId: number, signatureData: string, agriculteurId: number): Observable<LivraisonApi | null> {
    return this.http.post<LivraisonApi>(
      `${this.apiBase}/${livraisonId}/signature`,
      { signatureData },
      { params: new HttpParams().set('agriculteurId', String(agriculteurId)) }
    ).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      catchError((err) => {
        console.warn('Save signature failed.', err);
        return of(null);
      })
    );
  }

  ignorerNotationTransporteur(requestId: string, agriculteurId?: number): Observable<LivraisonApi | null> {
    const numericId = this.toNumericId(requestId);
    const ownerId = agriculteurId || this.getCurrentUserId();
    if (!numericId || !ownerId) {
      return of(null);
    }

    return this.http.post<LivraisonApi>(`${this.apiBase}/${numericId}/rating/ignore`, null, {
      params: new HttpParams().set('agriculteurId', String(ownerId))
    }).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      catchError((err) => {
        console.warn('Ignore rating failed.', err);
        return of(null);
      })
    );
  }

  getAll(): DeliveryRequest[] {
    const parsed = this.readFromStorage();
    return parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  getPendingFarmerRequests(): DeliveryRequest[] {
    return this.getAll().filter(
      (r) => r.createdByRole === 'Agriculteur' && r.status === 'En attente'
    );
  }

  getForCurrentFarmer(): DeliveryRequest[] {
    const userId = this.getCurrentUserId();
    return this.getAll().filter(
      (r) => r.createdByRole === 'Agriculteur' && r.createdById === userId
    );
  }

  getInProgressForCurrentFarmer(): DeliveryRequest[] {
    return this.getForCurrentFarmer().filter((r) => r.status === 'En cours');
  }

  getById(requestId: string): DeliveryRequest | null {
    return this.getAll().find((r) => r.id === requestId) || null;
  }

  getTransporterActiveRequests(): DeliveryRequest[] {
    const userId = this.getCurrentUserId();
    return this.getAll().filter(
      (r) => r.acceptedById === userId && (r.status === 'Acceptée' || r.status === 'En cours')
    );
  }

  getTransporterInProgressRequests(): DeliveryRequest[] {
    const userId = this.getCurrentUserId();
    return this.getAll().filter((r) => r.acceptedById === userId && r.status === 'En cours');
  }

  getTransporterHistoryRequests(): DeliveryRequest[] {
    const userId = this.getCurrentUserId();
    return this.getAll().filter((r) => r.acceptedById === userId && r.status === 'Livrée');
  }

  getTransporterTimelineRequests(): DeliveryRequest[] {
    const userId = this.getCurrentUserId();
    return this.getAll().filter(
      (r) => r.acceptedById === userId && (r.status === 'Acceptée' || r.status === 'En cours' || r.status === 'Livrée')
    );
  }

  getFarmerTimelineRequests(): DeliveryRequest[] {
    return this.getForCurrentFarmer().filter(
      (r) => r.status === 'Acceptée' || r.status === 'En cours' || r.status === 'Livrée'
    );
  }

  getTransporterCalendarRequests(): DeliveryRequest[] {
    const userId = this.getCurrentUserId();
    return this.getAll().filter(
      (r) => r.acceptedById === userId && (r.status === 'Acceptée' || r.status === 'En cours' || r.status === 'Livrée')
    );
  }

  acceptByCurrentTransporter(requestId: string): Observable<AcceptTransporterResult> {
    const numericId = this.toNumericId(requestId);
    const transporterId = this.getCurrentUserId();
    const previous = this.getById(requestId);

    if (!numericId) {
      return of({
        success: false,
        errorMessage: 'Identifiant de livraison invalide.'
      });
    }

    // Optimistic UI update
    this.updateRequest(requestId, {
      status: 'Acceptée',
      acceptedById: transporterId,
      acceptedByEmail: this.getCurrentUserEmail()
    });

    return this.http.put<LivraisonApi>(`${this.apiBase}/${numericId}/assign`, null, {
      params: new HttpParams().set('transporteurId', String(transporterId))
    }).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      switchMap((assigned) => this.http.put<LivraisonApi>(`${this.apiBase}/${numericId}/status`, null, {
        params: new HttpParams().set('status', 'ACCEPTEE')
      }).pipe(
        tap((updated) => this.upsertFromApi(updated)),
        catchError((err) => {
          console.warn('Accept transporter status sync failed after assign.', err);
          return of(assigned);
        })
      )),
      map((updated) => ({
        success: true,
        delivery: updated
      })),
      catchError((err) => {
        console.warn('Accept transporter backend sync failed.', err);
        if (previous) {
          this.updateRequest(requestId, {
            status: previous.status,
            acceptedById: previous.acceptedById,
            acceptedByEmail: previous.acceptedByEmail
          });
        }
        return of({
          success: false,
          errorMessage: this.extractBackendErrorMessage(err)
        });
      })
    );
  }

  startRouteToPickup(requestId: string): Observable<AcceptTransporterResult> {
    const numericId = this.toNumericId(requestId);
    const transporterId = this.getCurrentUserId();
    if (!numericId || !transporterId) {
      return of({ success: false, errorMessage: 'Identifiant de livraison invalide.' });
    }

    const blockingRequest = this.getTransporterInProgressRequests().find((r) => r.id !== requestId);
    if (blockingRequest) {
      return of({
        success: false,
        errorMessage: `Vous avez deja une livraison en cours (${blockingRequest.reference}). Terminez-la ou annulez-la avant d'en commencer une autre.`
      });
    }

    return this.http.post<LivraisonApi>(`${this.apiBase}/${numericId}/start-route`, null, {
      params: new HttpParams().set('transporteurId', String(transporterId))
    }).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      map((updated) => ({ success: true, delivery: updated })),
      catchError((err) => {
        console.warn('Start route backend sync failed.', err);
        return of({ success: false, errorMessage: this.extractBackendErrorMessage(err) });
      })
    );
  }

  createFromFarmer(input: DeliveryRequestInput): Observable<DeliveryRequest | null> {
    const currentUserId = this.getCurrentUserId();
    const payload = {
      reference: input.reference,
      type: this.toBackendTypeByWeight(input.weightKg),
      status: 'EN_ATTENTE',
      agriculteurId: currentUserId,
      transporteurId: 0,
      dateDepart: input.departureDate ? this.toDateTimePayload(input.departureDate) : undefined,
      datePreferenceAgriculteur: input.departureDate ? this.toDateTimePayload(input.departureDate) : undefined,
      adresseDepart: input.pickupLabel,
      adresseArrivee: input.dropoffLabel,
      latDepart: input.pickupLat,
      lngDepart: input.pickupLng,
      latArrivee: input.dropoffLat,
      lngArrivee: input.dropoffLng,
      poids: input.weightKg,
      typeProduit: input.product,
      detailsDemande: input.details,
      estRegroupable: input.autoGrouping,
      prix: input.estimatedPrice
    };

    return this.createApiDelivery(payload).pipe(
      map((saved) => (saved ? this.fromApi(saved) : null))
    );
  }

  getPreferredTransportersForCurrentFarmer(): Observable<FarmerKnownTransporter[]> {
    const agriculteurId = this.getCurrentUserId();
    if (!agriculteurId) {
      return of([]);
    }

    return this.http.get<FarmerKnownTransporter[]>(`${this.apiBase}/agriculteur/${agriculteurId}/transporteurs-preferes`).pipe(
      map((items) => Array.isArray(items) ? items : []),
      catchError((err) => {
        console.warn('Load preferred transporters failed.', err);
        return of([]);
      })
    );
  }

  createFromFarmerToTransporter(input: DeliveryRequestInput, transporteurId: number): Observable<TargetedCreateResult> {
    const agriculteurId = this.getCurrentUserId();
    if (!agriculteurId || !transporteurId) {
      return of({
        delivery: null,
        errorMessage: 'Transporteur invalide.'
      });
    }

    const payload = {
      reference: input.reference,
      product: input.product,
      weightKg: input.weightKg,
      details: input.details,
      departureDate: input.departureDate ? this.toDateTimePayload(input.departureDate) : undefined,
      pickupLabel: input.pickupLabel,
      dropoffLabel: input.dropoffLabel,
      estimatedPrice: input.estimatedPrice,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      autoGrouping: input.autoGrouping,
      transporteurId
    };

    return this.http.post<LivraisonApi>(`${this.apiBase}/agriculteur/${agriculteurId}/livraisons/cibler-transporteur`, payload).pipe(
      tap((saved) => this.upsertFromApi(saved)),
      map((saved) => ({
        delivery: saved ? this.fromApi(saved) : null
      })),
      catchError((err) => {
        console.warn('Create targeted delivery failed.', err);
        return of({
          delivery: null,
          errorMessage: this.extractBackendErrorMessage(err)
        });
      })
    );
  }

  estimateDeliveryPrice(input: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    weightKg: number;
    autoGrouping: boolean;
    distanceKm?: number;
    durationHours?: number;
  }): Observable<DeliveryPriceEstimate | null> {
    const payload = {
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      weightKg: input.weightKg,
      autoGrouping: input.autoGrouping,
      distanceKm: input.distanceKm,
      durationHours: input.durationHours
    };

    return this.http.post<DeliveryPriceEstimate>(`${this.apiBase}/pricing/estimate`, payload).pipe(
      map((estimate) => estimate || null),
      catchError((err) => {
        console.warn('Estimate delivery price failed.', err);
        return of(null);
      })
    );
  }

  updateStatus(requestId: string, status: DeliveryRequestStatus): void {
    this.updateStatusApi(requestId, status).subscribe();
  }

  updateStatusApi(requestId: string, status: DeliveryRequestStatus): Observable<LivraisonApi | null> {
    this.updateRequest(requestId, { status });

    const numericId = this.toNumericId(requestId);
    if (!numericId) {
      return of(null);
    }

    return this.http.put<LivraisonApi>(`${this.apiBase}/${numericId}/status`, null, {
      params: new HttpParams().set('status', this.toBackendStatus(status))
    }).pipe(
      tap((updated) => this.upsertFromApi(updated)),
      catchError((err) => {
        console.warn('Update status backend sync failed.', err);
        return of(null);
      })
    );
  }

  updateRequest(requestId: string, patch: Partial<DeliveryRequest>): void {
    const requests = this.readFromStorage();
    const updated = requests.map((r) => (r.id === requestId ? { ...r, ...patch } : r));
    this.writeToStorage(updated);
  }

  private readFromStorage(): DeliveryRequest[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as DeliveryRequest[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeToStorage(requests: DeliveryRequest[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(requests));
  }

  private isFarmerRole(): boolean {
    const role = getDeliveryUserRole();
    return role === 'agriculteur' || role === 'farmer' || role.includes('agric');
  }

  public isUserFarmerRole(): boolean {
    return this.isFarmerRole();
  }

  private toNumericId(id: string): number {
    const direct = Number(id);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const digits = id.replace(/\D/g, '');
    const parsed = Number(digits);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private toBackendTypeByWeight(weightKg: number): 'LOCALE' | 'LONGUE_DISTANCE' {
    return weightKg >= 250 ? 'LONGUE_DISTANCE' : 'LOCALE';
  }

  private normalizeAdminKpis(payload: Record<string, unknown> | null | undefined): DeliveryAdminKpis {
    const source = payload || {};
    return {
      total: this.toNumber(source['total']),
      enAttente: this.toNumber(source['enAttente']),
      acceptees: this.toNumber(source['acceptees']),
      enCours: this.toNumber(source['enCours']),
      livre: this.toNumber(source['livre']),
      annulees: this.toNumber(source['annulees']),
      revenue: this.toNumber(source['revenue']),
      avgPrice: this.toNumber(source['avgPrice']),
      tauxLivraison: this.toNumber(source['tauxLivraison'])
    };
  }

  private emptyAdminKpis(): DeliveryAdminKpis {
    return {
      total: 0,
      enAttente: 0,
      acceptees: 0,
      enCours: 0,
      livre: 0,
      annulees: 0,
      revenue: 0,
      avgPrice: 0,
      tauxLivraison: 0
    };
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toBackendStatus(status: DeliveryRequestStatus): string {
    const mapStatus: Record<DeliveryRequestStatus, string> = {
      'En attente': 'EN_ATTENTE',
      'Acceptée': 'ACCEPTEE',
      'En cours': 'EN_COURS',
      'Livrée': 'LIVREE',
      'Refusée': 'ANNULEE'
    };
    return mapStatus[status];
  }

  private fromBackendStatus(status?: string): DeliveryRequestStatus {
    switch ((status || '').toUpperCase()) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'ACCEPTEE':
        return 'Acceptée';
      case 'EN_COURS':
      case 'RETARD':
        return 'En cours';
      case 'LIVREE':
        return 'Livrée';
      case 'ANNULEE':
      default:
        return 'Refusée';
    }
  }

  private toDateTimePayload(value: string): string {
    if (!value) {
      return value;
    }
    return value.includes('T') ? value : `${value}T00:00:00`;
  }

  private extractBackendErrorMessage(err: any): string {
    const message = err?.error?.message
      || err?.error?.reason
      || err?.error?.error
      || err?.message
      || '';

    if (message && message !== 'Bad Request' && !message.includes('Http failure response')) {
      return message;
    }

    if (err?.status === 400) {
      return 'Operation refusee par le service livraison. Verifiez le planning du jour, la date/heure prevue et les contraintes de prix.';
    }

    if (err?.status === 403) {
      return 'Action non autorisee pour cet utilisateur.';
    }

    if (err?.status === 409) {
      return 'Conflit detecte: cette action n est pas possible dans l etat actuel.';
    }

    return 'Operation impossible pour le moment.';
  }

  private fromApi(api: LivraisonApi): DeliveryRequest {
    const acceptedById = api.transporteurId && api.transporteurId > 0 ? api.transporteurId : undefined;
    const apiAny = api as any;
    const farmerFallbackEmail = apiAny?.createdByEmail || `farmer-${api.agriculteurId}@local`;
    const transporterFallbackEmail = acceptedById
      ? (apiAny?.acceptedByEmail || `transporter-${acceptedById}@local`)
      : undefined;
    const createdByEmail = this.resolveKnownEmail(api.agriculteurId, farmerFallbackEmail);
    const acceptedByEmail = acceptedById
      ? this.resolveKnownEmail(acceptedById, transporterFallbackEmail)
      : undefined;

    this.rememberKnownUser(api.agriculteurId, createdByEmail);
    if (acceptedById && acceptedByEmail) {
      this.rememberKnownUser(acceptedById, acceptedByEmail);
    }

    return {
      id: String(api.id),
      reference: api.reference || `DLV-${api.id}`,
      product: api.typeProduit || 'Produit',
      weightKg: Number(api.poids || 0),
      details: api.detailsDemande || '',
      pickupLabel: api.adresseDepart || `${api.latDepart ?? 0}, ${api.lngDepart ?? 0}`,
      dropoffLabel: api.adresseArrivee || `${api.latArrivee ?? 0}, ${api.lngArrivee ?? 0}`,
      estimatedPrice: Number(api.prix || 0),
      pickupLat: Number(api.latDepart || 0),
      pickupLng: Number(api.lngDepart || 0),
      dropoffLat: Number(api.latArrivee || 0),
      dropoffLng: Number(api.lngArrivee || 0),
      autoGrouping: Boolean(api.estRegroupable),
      status: this.fromBackendStatus(api.status),
      createdByRole: 'Agriculteur',
      createdByEmail,
      createdById: api.agriculteurId,
      acceptedById,
      acceptedByEmail,
      createdAt: api.dateCreation || new Date().toISOString(),
      departureDate: api.dateDepart,
      plannedDeliveryDate: api.dateLivraisonPrevue,
      deliveredAt: api.dateLivraisonEffective,
      grouped: Boolean(api.grouped),
      groupReference: api.groupReference || undefined,
      rating: Number(api.note || 0) || undefined,
      ratingStatus: (api.ratingStatus as DeliveryRequest['ratingStatus']) || undefined,
      currentLat: Number(api.latActuelle || 0) || undefined,
      currentLng: Number(api.lngActuelle || 0) || undefined,
      signatureStatus: api.signatureStatus || undefined
    };
  }

  private upsertFromApi(api: LivraisonApi): void {
    const mapped = this.fromApi(api);
    const all = this.readFromStorage();
    const index = all.findIndex((x) => x.id === mapped.id);
    if (index >= 0) all[index] = mapped;
    else all.unshift(mapped);
    this.writeToStorage(all);
  }

  private removeFromStorage(requestId: string): void {
    const normalizedId = String(this.toNumericId(requestId) || requestId);
    const remaining = this.readFromStorage().filter((item) => item.id !== normalizedId && item.id !== requestId);
    this.writeToStorage(remaining);
  }

  private captureCurrentUserIdentity(): void {
    const id = getDeliveryUserId();
    const emailRaw = getDeliveryUserEmail();
    if (!id || id <= 0 || !emailRaw || emailRaw === 'unknown@local') {
      return;
    }
    this.rememberKnownUser(id, emailRaw);
  }

  private readKnownUsers(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.usersDirectoryKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeKnownUsers(users: Record<string, string>): void {
    localStorage.setItem(this.usersDirectoryKey, JSON.stringify(users));
  }

  private rememberKnownUser(userId: number, email?: string): void {
    if (!Number.isFinite(userId) || userId <= 0 || !email) {
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }
    const users = this.readKnownUsers();
    users[String(userId)] = normalizedEmail;
    this.writeKnownUsers(users);
  }

  private resolveKnownEmail(userId: number, fallbackEmail?: string): string {
    const users = this.readKnownUsers();
    const known = users[String(userId)];
    if (known) {
      return known;
    }
    return fallbackEmail || 'unknown@local';
  }
}
