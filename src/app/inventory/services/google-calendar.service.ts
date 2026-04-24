import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

declare const google: any;

export interface GCalEvent {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end:   { date?: string; dateTime?: string; timeZone?: string };
  colorId?: string;
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
}

export interface GCalEventCreated {
  id: string;
  htmlLink: string;
  summary: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {

  // ⚠️  Remplace par ton Client ID OAuth2 Google
  private CLIENT_ID = '644098010516-unvbcuieq1ok2eivphlg0n8s2qbvepev.apps.googleusercontent.com';
  private SCOPES    = 'https://www.googleapis.com/auth/calendar.events';
  private TZ        = 'Africa/Tunis';
  private accessToken: string | null = null;

  constructor(private http: HttpClient) {}

  // ── Autorisation OAuth2 ─────────────────────────────────────
  authorize(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services non chargé. Vérifie index.html'));
        return;
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (resp: any) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          this.accessToken = resp.access_token;
          resolve(resp.access_token);
        }
      });
      client.requestAccessToken({ prompt: 'consent' });
    });
  }

  // ── Appel API générique ─────────────────────────────────────
  createEvent(event: GCalEvent): Observable<GCalEventCreated> {
    const post = (token: string) => {
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
      return this.http.post<GCalEventCreated>(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        event, { headers }
      );
    };

    if (this.accessToken) {
      return post(this.accessToken).pipe(
        catchError(err => {
          if (err.status === 401) {
            this.accessToken = null;
            return from(this.authorize()).pipe(switchMap(t => post(t)));
          }
          return throwError(() => err);
        })
      );
    }
    return from(this.authorize()).pipe(switchMap(t => post(t)));
  }

  // ═══════════════════════════════════════════════════════════
  //  VACCINATION — Campagne
  // ═══════════════════════════════════════════════════════════
  buildVaccinationEvent(campaign: {
    espece: string;
    ageMin: number;
    ageMax: number;
    plannedDate: string;
    productName?: string;
    dose: number;
  }): GCalEvent {
    return {
      summary: `💉 Vaccination ${campaign.espece}`,
      description:
        `Campagne de vaccination\n` +
        `Espèce : ${campaign.espece}\n` +
        `Tranche d'âge : ${campaign.ageMin} – ${campaign.ageMax} ans\n` +
        `Vaccin : ${campaign.productName || 'N/A'}\n` +
        `Dose par animal : ${campaign.dose} unités`,
      start: { date: campaign.plannedDate },
      end:   { date: campaign.plannedDate },
      colorId: '2',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 1440 },
          { method: 'popup', minutes: 60 }
        ]
      }
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  VÉTÉRINAIRE — Disponibilité
  //  Événement vert "🩺 Consultations disponibles"
  // ═══════════════════════════════════════════════════════════
  createAvailabilityEvent(params: {
    date: string;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    vetName?: string;
  }): Observable<GCalEventCreated> {
    const slots = this.calcSlotCount(params.startTime, params.endTime, params.slotDurationMinutes);
    const event: GCalEvent = {
      summary: `🩺 Consultations disponibles${params.vetName ? ' — Dr. ' + params.vetName : ''}`,
      description:
        `Plage de disponibilité vétérinaire\n` +
        `Horaire : ${params.startTime} → ${params.endTime}\n` +
        `Durée par créneau : ${params.slotDurationMinutes} min\n` +
        `Nombre de créneaux : ${slots}`,
      start: { dateTime: `${params.date}T${params.startTime}:00`, timeZone: this.TZ },
      end:   { dateTime: `${params.date}T${params.endTime}:00`,   timeZone: this.TZ },
      colorId: '2',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 15 }
        ]
      }
    };
    return this.createEvent(event);
  }

  // ═══════════════════════════════════════════════════════════
  //  VÉTÉRINAIRE — Indisponibilité
  //  Événement rouge "🚫 Indisponible"
  // ═══════════════════════════════════════════════════════════
  createUnavailabilityEvent(params: {
    startDate: string;
    endDate: string;
    fullDay: boolean;
    startTime?: string | null;
    endTime?: string | null;
    recurringWeekly: boolean;
    dayOfWeek?: string | null;
    reason?: string | null;
    vetName?: string;
  }): Observable<GCalEventCreated> {
    const title = params.reason
      ? `🚫 Indisponible — ${params.reason}`
      : `🚫 Indisponible${params.vetName ? ' — Dr. ' + params.vetName : ''}`;

    const desc = [
      params.reason ? `Motif : ${params.reason}` : null,
      params.recurringWeekly ? `Récurrent : chaque ${this.dayLabel(params.dayOfWeek)}` : null,
      !params.fullDay && params.startTime
        ? `Horaire : ${params.startTime} → ${params.endTime}`
        : 'Journée entière'
    ].filter(Boolean).join('\n');

    let event: GCalEvent;

    if (params.fullDay) {
      event = {
        summary: title,
        description: desc,
        start: { date: params.startDate },
        end:   { date: this.addDays(params.endDate, 1) },
        colorId: '11',
        reminders: { useDefault: false }
      };
    } else {
      event = {
        summary: title,
        description: desc,
        start: { dateTime: `${params.startDate}T${params.startTime}:00`, timeZone: this.TZ },
        end:   { dateTime: `${params.startDate}T${params.endTime}:00`,   timeZone: this.TZ },
        colorId: '11',
        reminders: { useDefault: false }
      };
    }

    return this.createEvent(event);
  }

  // ═══════════════════════════════════════════════════════════
  //  VÉTÉRINAIRE — Blocage journée
  //  Événement gris "🔒 Jour bloqué"
  // ═══════════════════════════════════════════════════════════
  createBlockDayEvent(params: {
    date: string;
    vetName?: string;
  }): Observable<GCalEventCreated> {
    const event: GCalEvent = {
      summary: `🔒 Jour bloqué${params.vetName ? ' — Dr. ' + params.vetName : ''}`,
      description: `Aucune consultation disponible ce jour.`,
      start: { date: params.date },
      end:   { date: this.addDays(params.date, 1) },
      colorId: '8',
      reminders: { useDefault: false }
    };
    return this.createEvent(event);
  }

  // ── Utilitaires ─────────────────────────────────────────────
  private calcSlotCount(start: string, end: string, duration: number): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.floor(((eh * 60 + em) - (sh * 60 + sm)) / duration);
  }

  private addDays(iso: string, n: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  private dayLabel(day?: string | null): string {
    const map: Record<string, string> = {
      MONDAY: 'Lundi', TUESDAY: 'Mardi', WEDNESDAY: 'Mercredi',
      THURSDAY: 'Jeudi', FRIDAY: 'Vendredi', SATURDAY: 'Samedi', SUNDAY: 'Dimanche'
    };
    return day ? (map[day] || day) : '';
  }
}