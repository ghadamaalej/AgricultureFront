import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

declare const google: any;

export interface CalendarEvent {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  colorId?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: { method: string; minutes: number }[];
  };
}

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {

  // ⚠️ Remplace par ton Client ID Google OAuth2
  private CLIENT_ID = '644098010516-unvbcuieq1ok2eivphlg0n8s2qbvepev.apps.googleusercontent.com';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  private accessToken: string | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Lance le popup OAuth2 Google et récupère le token d'accès.
   * Retourne une Promise<string> avec le token.
   */
  authorize(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services non chargé. Vérifie index.html'));
        return;
      }

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error('Erreur OAuth2 : ' + response.error));
            return;
          }
          this.accessToken = response.access_token;
          resolve(response.access_token);
        }
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /**
   * Crée un événement dans Google Calendar.
   * Demande automatiquement l'autorisation si pas encore connecté.
   */
  createEvent(event: CalendarEvent): Observable<any> {
    const doCreate = (token: string) => {
      const headers = new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
      return this.http.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        event,
        { headers }
      );
    };

    if (this.accessToken) {
      return doCreate(this.accessToken).pipe(
        catchError(err => {
          // Token expiré → réautoriser
          if (err.status === 401) {
            this.accessToken = null;
            return from(this.authorize()).pipe(
              switchMap(token => doCreate(token))
            );
          }
          return throwError(() => err);
        })
      );
    }

    return from(this.authorize()).pipe(
      switchMap(token => doCreate(token))
    );
  }

  /**
   * Construit un CalendarEvent depuis une campagne de vaccination.
   */
  buildVaccinationEvent(campaign: {
    espece: string;
    ageMin: number;
    ageMax: number;
    plannedDate: string;
    productName?: string;
    dose: number;
  }): CalendarEvent {
    return {
      summary: `💉 Vaccination ${campaign.espece}`,
      description:
        `Campagne de vaccination\n` +
        `Espèce : ${campaign.espece}\n` +
        `Tranche d'âge : ${campaign.ageMin} – ${campaign.ageMax} ans\n` +
        `Vaccin : ${campaign.productName || 'N/A'}\n` +
        `Dose par animal : ${campaign.dose} unités`,
      start: { date: campaign.plannedDate },
      end: { date: campaign.plannedDate },
      colorId: '2', // vert (Sage)
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 1440 }, // rappel 24h avant
          { method: 'popup', minutes: 60 }    // rappel 1h avant
        ]
      }
    };
  }
}