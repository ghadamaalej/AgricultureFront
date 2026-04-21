import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface FarmerChatbotApiResponse {
  reply: string;
  model?: string;
  createdAt?: string;
  message?: string;
  detail?: string;
  error?: string;
}

export interface BestDayChatbotPayload {
  farmerId?: number;
  message: string;
  pickupLat: number;
  pickupLng: number;
  fromDate: string;
  toDate: string;
}

export interface DateSuggestionInput {
  pickupLat: number;
  pickupLng: number;
  preferredDate: string;
  currentEstimatedPrice: number;
  windowDays?: number;
}

export interface DateSuggestionResult {
  suggestedDate: string;
  suggestedDateTime: string;
  originalSurchargePercent: number;
  suggestedSurchargePercent: number;
  originalPrice: number;
  suggestedPrice: number;
  savings: number;
  explanation: string;
  dayScores: Array<{ date: string; surcharge: number; summary: string }>;
  isAlreadyOptimal: boolean;
}

interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
}

interface WeatherHour {
  isoTime: string;
  timestamp: number;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
}

@Injectable({
  providedIn: 'root'
})
export class FarmerChatbotService {
  private readonly backendUrl = '/livraison/api/livraisons/chatbot/farmer';

  getBestDayAdvice(payload: BestDayChatbotPayload): Observable<string> {
    return new Observable<string>((observer) => {
      this.callBackend(payload)
        .catch(() => this.callGroqDirect(payload))
        .then((reply) => {
          observer.next(reply);
          observer.complete();
        })
        .catch((error: Error) => {
          observer.error(error?.message ? error : new Error('Le service assistance est indisponible pour le moment.'));
        });
    });
  }

  private async callBackend(payload: BestDayChatbotPayload): Promise<string> {
    const response = await fetch(`${this.backendUrl}/best-day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = (await response.json().catch(() => ({}))) as Partial<FarmerChatbotApiResponse>;
    if (!response.ok) {
      throw new Error(this.extractBackendErrorMessage(body) || this.fallbackErrorMessage(response.status));
    }
    const reply = (body?.reply ?? '').trim();
    if (!reply) {
      throw new Error('empty backend reply');
    }
    return reply;
  }

  private async callGroqDirect(payload: BestDayChatbotPayload): Promise<string> {
    if (!environment.groqApiKey || environment.groqApiKey.startsWith('YOUR_')) {
      throw new Error('Clé Groq non configurée dans environment.ts.');
    }

    const weather = await this.fetchWeather(payload.pickupLat, payload.pickupLng, payload.fromDate, payload.toDate);
    const weatherSummary = weather
      .map(
        (d) =>
          `- ${d.date}: max ${d.tempMax}°C / min ${d.tempMin}°C, pluie ${d.precipitation}mm, vent ${d.windSpeed}km/h`
      )
      .join('\n');

    const systemPrompt =
      'Tu es un assistant agricole specialise dans UNE seule question: recommander le meilleur jour pour planifier une livraison ' +
      'selon la meteo et une majoration tarifaire appliquee les jours defavorables (pluie forte, vent fort, temperatures extremes). ' +
      'Reponds en francais, de maniere concise (4-6 phrases max). Donne une date recommandee, justifie brievement, et mentionne la majoration si pertinent.';

    const userPrompt =
      `Lieu: lat=${payload.pickupLat}, lng=${payload.pickupLng}\n` +
      `Periode: du ${payload.fromDate} au ${payload.toDate}\n` +
      `Previsions meteo:\n${weatherSummary || '(indisponible)'}\n\n` +
      `Question du producteur: ${payload.message}`;

    const response = await fetch(environment.groqApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${environment.groqApiKey}`
      },
      body: JSON.stringify({
        model: environment.groqModel,
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`Groq HTTP ${response.status}: ${txt.slice(0, 200) || 'erreur inconnue'}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error('Reponse Groq vide.');
    }
    return reply;
  }

  suggestBestDate(input: DateSuggestionInput): Observable<DateSuggestionResult> {
    return new Observable<DateSuggestionResult>((observer) => {
      this.computeSuggestion(input)
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error: Error) => {
          observer.error(error?.message ? error : new Error('Impossible de calculer une suggestion IA.'));
        });
    });
  }

  private async computeSuggestion(input: DateSuggestionInput): Promise<DateSuggestionResult> {
    const windowDays = input.windowDays ?? 7;
    const preferred = new Date(input.preferredDate);
    if (isNaN(preferred.getTime())) {
      throw new Error('Date favorite invalide.');
    }

    const toLocalIso = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const preferredDateIso = toLocalIso(preferred);

    const now = new Date();
    const fromMs = Math.max(preferred.getTime() - windowDays * 86400000, now.getTime());
    const fromIso = toLocalIso(new Date(fromMs));
    const toIso = toLocalIso(new Date(preferred.getTime() + windowDays * 86400000));

    const hours = await this.fetchWeatherHourly(input.pickupLat, input.pickupLng, fromIso, toIso);
    if (!hours.length) {
      throw new Error('Previsions meteo indisponibles pour cette periode.');
    }

    const earliestAllowedMs = now.getTime() + 30 * 60 * 1000;
    const preferredMs = preferred.getTime();

    const scored = hours
      .filter((h) => h.timestamp >= earliestAllowedMs)
      .map((h) => {
        const surcharge = this.estimateHourSurcharge(h);
        return {
          isoTime: h.isoTime,
          timestamp: h.timestamp,
          surcharge,
          summary: this.summarizeHour(h),
          distanceHours: Math.abs(h.timestamp - preferredMs) / 3600000
        };
      });

    if (!scored.length) {
      throw new Error('Aucun creneau disponible dans la fenetre analysee.');
    }

    const findClosest = (): typeof scored[number] => {
      let closest = scored[0];
      for (const s of scored) {
        if (s.distanceHours < closest.distanceHours) closest = s;
      }
      return closest;
    };
    const originalSlot = findClosest();
    const originalSurcharge = originalSlot.surcharge;

    const ranked = [...scored].sort((a, b) => {
      if (a.surcharge !== b.surcharge) return a.surcharge - b.surcharge;
      return a.distanceHours - b.distanceHours;
    });
    const best = ranked[0];

    const basePrice =
      originalSurcharge > 0
        ? input.currentEstimatedPrice / (1 + originalSurcharge / 100)
        : input.currentEstimatedPrice;
    const suggestedPrice = basePrice * (1 + best.surcharge / 100);
    const savings = Math.max(0, input.currentEstimatedPrice - suggestedPrice);
    const isAlreadyOptimal =
      best.isoTime === originalSlot.isoTime ||
      best.surcharge >= originalSurcharge ||
      savings < 0.5;

    const suggestedDateTime = best.isoTime.slice(0, 16);
    const suggestedDate = best.isoTime.slice(0, 10);

    const originalDayView = {
      date: originalSlot.isoTime.slice(0, 16).replace('T', ' '),
      surcharge: originalSlot.surcharge,
      summary: originalSlot.summary
    };
    const bestDayView = {
      date: best.isoTime.slice(0, 16).replace('T', ' '),
      surcharge: best.surcharge,
      summary: best.summary
    };
    const scoredView = scored
      .filter((_, idx) => idx % 3 === 0)
      .slice(0, 24)
      .map((s) => ({
        date: s.isoTime.slice(0, 16).replace('T', ' '),
        surcharge: s.surcharge,
        summary: s.summary
      }));

    const explanation = await this.buildAiExplanation({
      preferredDateIso,
      originalDay: originalDayView,
      best: bestDayView,
      scored: scoredView,
      basePrice,
      suggestedPrice,
      currentPrice: input.currentEstimatedPrice,
      savings,
      isAlreadyOptimal
    }).catch(() => this.fallbackExplanation(originalDayView, bestDayView, savings, isAlreadyOptimal));

    return {
      suggestedDate,
      suggestedDateTime,
      originalSurchargePercent: originalSurcharge,
      suggestedSurchargePercent: best.surcharge,
      originalPrice: input.currentEstimatedPrice,
      suggestedPrice: Math.round(suggestedPrice * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      explanation,
      dayScores: scoredView,
      isAlreadyOptimal
    };
  }

  private estimateHourSurcharge(h: WeatherHour): number {
    let pct = 0;
    if (h.precipitation >= 5) pct += 35;
    else if (h.precipitation >= 2) pct += 20;
    else if (h.precipitation >= 0.5) pct += 10;

    if (h.windSpeed >= 55) pct += 25;
    else if (h.windSpeed >= 40) pct += 15;
    else if (h.windSpeed >= 25) pct += 5;

    if (h.temperature >= 40 || h.temperature <= 0) pct += 15;
    else if (h.temperature >= 36 || h.temperature <= 3) pct += 8;

    const stormCodes = [95, 96, 99, 82, 75, 86];
    if (stormCodes.includes(h.weatherCode)) pct += 10;

    return Math.min(pct, 60);
  }

  private summarizeHour(h: WeatherHour): string {
    return `${h.temperature}°C, pluie ${h.precipitation}mm, vent ${h.windSpeed}km/h`;
  }

  private estimateWeatherSurcharge(day: WeatherDay): number {
    let pct = 0;
    if (day.precipitation >= 15) pct += 35;
    else if (day.precipitation >= 5) pct += 20;
    else if (day.precipitation >= 1) pct += 8;

    if (day.windSpeed >= 60) pct += 25;
    else if (day.windSpeed >= 40) pct += 15;
    else if (day.windSpeed >= 25) pct += 5;

    if (day.tempMax >= 40 || day.tempMin <= 0) pct += 15;
    else if (day.tempMax >= 36 || day.tempMin <= 3) pct += 8;

    const stormCodes = [95, 96, 99, 82, 75, 86];
    if (stormCodes.includes(day.weatherCode)) pct += 10;

    return Math.min(pct, 60);
  }

  private summarizeDay(day: WeatherDay): string {
    return `max ${day.tempMax}°C / min ${day.tempMin}°C, pluie ${day.precipitation}mm, vent ${day.windSpeed}km/h`;
  }

  private fallbackExplanation(
    original: { date: string; surcharge: number; summary: string },
    best: { date: string; surcharge: number; summary: string },
    savings: number,
    isAlreadyOptimal: boolean
  ): string {
    if (isAlreadyOptimal) {
      return `Votre date (${original.date}) est deja optimale: ${original.summary}. Aucune economie possible dans la fenetre analysee.`;
    }
    return (
      `Le ${best.date} offre de meilleures conditions (${best.summary}) avec une majoration meteo de ${best.surcharge}% ` +
      `contre ${original.surcharge}% le ${original.date}. Economie estimee: ${savings.toFixed(2)} TND.`
    );
  }

  private async buildAiExplanation(ctx: {
    preferredDateIso: string;
    originalDay: { date: string; surcharge: number; summary: string };
    best: { date: string; surcharge: number; summary: string };
    scored: Array<{ date: string; surcharge: number; summary: string }>;
    basePrice: number;
    suggestedPrice: number;
    currentPrice: number;
    savings: number;
    isAlreadyOptimal: boolean;
  }): Promise<string> {
    if (!environment.groqApiKey || environment.groqApiKey.startsWith('YOUR_')) {
      return this.fallbackExplanation(ctx.originalDay, ctx.best, ctx.savings, ctx.isAlreadyOptimal);
    }

    const daysList = ctx.scored
      .map((s) => `- ${s.date}: ${s.summary} (majoration ${s.surcharge}%)`)
      .join('\n');

    const system =
      'Tu es un assistant agricole. Analyse les previsions et recommande le meilleur jour pour une livraison. ' +
      'Reponds en francais, 3 a 5 phrases, ton direct et rassurant. Mentionne la date recommandee, ' +
      'les conditions meteo, et l economie en TND si applicable.';

    const user =
      `Date favorite du producteur: ${ctx.preferredDateIso} (majoration ${ctx.originalDay.surcharge}%, prix ${ctx.currentPrice.toFixed(2)} TND).\n` +
      `Meilleur jour identifie: ${ctx.best.date} (majoration ${ctx.best.surcharge}%, prix ${ctx.suggestedPrice.toFixed(2)} TND).\n` +
      `Economie: ${ctx.savings.toFixed(2)} TND.\n` +
      `Deja optimal: ${ctx.isAlreadyOptimal ? 'oui' : 'non'}.\n\n` +
      `Previsions fenetre:\n${daysList}`;

    const response = await fetch(environment.groqApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${environment.groqApiKey}`
      },
      body: JSON.stringify({
        model: environment.groqModel,
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return reply || this.fallbackExplanation(ctx.originalDay, ctx.best, ctx.savings, ctx.isAlreadyOptimal);
  }

  private async fetchWeatherHourly(lat: number, lng: number, from: string, to: string): Promise<WeatherHour[]> {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&hourly=temperature_2m,precipitation,windspeed_10m,weathercode` +
        `&timezone=auto&start_date=${from}&end_date=${to}`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      const h = j?.hourly;
      if (!h?.time) return [];
      return h.time.map((isoTime: string, i: number) => {
        const [datePart, timePart] = isoTime.split('T');
        const [y, mo, d] = datePart.split('-').map(Number);
        const [hr, mi] = (timePart || '00:00').split(':').map(Number);
        const ts = new Date(y, (mo || 1) - 1, d || 1, hr || 0, mi || 0).getTime();
        return {
          isoTime,
          timestamp: ts,
          temperature: Math.round((h.temperature_2m?.[i] ?? 0) * 10) / 10,
          precipitation: Math.round((h.precipitation?.[i] ?? 0) * 10) / 10,
          windSpeed: Math.round((h.windspeed_10m?.[i] ?? 0) * 10) / 10,
          weatherCode: h.weathercode?.[i] ?? 0
        };
      });
    } catch {
      return [];
    }
  }

  private async fetchWeather(lat: number, lng: number, from: string, to: string): Promise<WeatherDay[]> {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode` +
        `&timezone=auto&start_date=${from}&end_date=${to}`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      const d = j?.daily;
      if (!d?.time) return [];
      return d.time.map((date: string, i: number) => ({
        date,
        tempMax: d.temperature_2m_max?.[i] ?? 0,
        tempMin: d.temperature_2m_min?.[i] ?? 0,
        precipitation: d.precipitation_sum?.[i] ?? 0,
        windSpeed: d.windspeed_10m_max?.[i] ?? 0,
        weatherCode: d.weathercode?.[i] ?? 0
      }));
    } catch {
      return [];
    }
  }

  private extractBackendErrorMessage(body: Partial<FarmerChatbotApiResponse>): string {
    const candidates = [body.message, body.detail, body.error]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);
    return candidates[0] || '';
  }

  private fallbackErrorMessage(status: number): string {
    if (status === 503) return 'Le chatbot est indisponible (configuration ou service externe).';
    if (status === 502) return 'Le fournisseur IA est indisponible pour le moment.';
    if (status === 400) return 'Parametres invalides: verifiez lieu, dates et message.';
    return 'Le service assistance est indisponible pour le moment.';
  }
}
