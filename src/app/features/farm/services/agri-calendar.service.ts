import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ClimateMonthSummary, CropWindow, IrrigationAdvice, WeatherForecastDay } from '../models/calendar.model';

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
    et0_fao_evapotranspiration: number[];
  };
}

interface ArchiveDailyResponse {
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
  };
}

interface FaoSowingHarvest {
  month: string;
  day: string;
}

interface FaoSession {
  comments?: string;
  early_sowing?: FaoSowingHarvest;
  later_sowing?: FaoSowingHarvest;
  early_harvest?: FaoSowingHarvest;
  late_harvest?: FaoSowingHarvest;
}

interface FaoCalendarEntry {
  id_country: string;
  crop: { id: string; name: string };
  aez: { id: string; name: string };
  sessions: FaoSession[];
}

@Injectable({
  providedIn: 'root'
})
export class AgriCalendarService {
  private readonly openMeteoApi = 'https://api.open-meteo.com/v1/forecast';
  private readonly archiveApi = 'https://archive-api.open-meteo.com/v1/archive';
  private readonly faoCropCalendarApi = 'https://api-cropcalendar.apps.fao.org/api/v1/cropCalendar';

  constructor(private http: HttpClient) {}

  getWeatherForecast(latitude: number, longitude: number): Observable<WeatherForecastDay[]> {
    const params = [
      `latitude=${latitude}`,
      `longitude=${longitude}`,
      'daily=temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration',
      'forecast_days=7',
      'timezone=auto'
    ].join('&');

    return this.http.get<OpenMeteoDailyResponse>(`${this.openMeteoApi}?${params}`).pipe(
      map((response) => {
        const daily = response.daily;
        return daily.time.map((date, i) => ({
          date,
          tempMin: daily.temperature_2m_min?.[i] ?? 0,
          tempMax: daily.temperature_2m_max?.[i] ?? 0,
          precipitation: daily.precipitation_sum?.[i] ?? 0,
          evapotranspiration: daily.et0_fao_evapotranspiration?.[i] ?? 0
        }));
      }),
      catchError((error) => {
        console.error('Open-Meteo fetch failed:', error);
        return of([]);
      })
    );
  }

  /**
   * Last full calendar year of daily archive → monthly averages / totals at the farm coordinates.
   * Complements the short forecast; INM bulletins are not available from the browser (CORS).
   */
  getLocalClimateMonthly(latitude: number, longitude: number): Observable<ClimateMonthSummary[]> {
    const end = new Date();
    const year = end.getFullYear() - 1;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const params = [
      `latitude=${latitude}`,
      `longitude=${longitude}`,
      `start_date=${startDate}`,
      `end_date=${endDate}`,
      'daily=temperature_2m_min,temperature_2m_max,precipitation_sum',
      'timezone=auto'
    ].join('&');

    return this.http.get<ArchiveDailyResponse>(`${this.archiveApi}?${params}`).pipe(
      map((res) => this.aggregateMonthly(res.daily.time, res.daily.temperature_2m_min, res.daily.temperature_2m_max, res.daily.precipitation_sum)),
      catchError((err) => {
        console.error('Open-Meteo archive failed:', err);
        return of([]);
      })
    );
  }

  buildIrrigationAdvice(forecast: WeatherForecastDay[]): IrrigationAdvice[] {
    return forecast.map((day) => {
      if (day.precipitation < 2 && day.evapotranspiration > 4) {
        return {
          date: day.date,
          advice: 'Irrigate',
          reason: 'Low rain and high evapotranspiration expected.'
        };
      }

      if (day.precipitation >= 5) {
        return {
          date: day.date,
          advice: 'Skip',
          reason: 'Enough rainfall expected.'
        };
      }

      return {
        date: day.date,
        advice: 'Monitor',
        reason: 'Conditions are moderate, check soil moisture.'
      };
    });
  }

  /**
   * FAO crop calendar for Tunisia (official API). Filters by crop name (substring match).
   */
  getCropWindows(crop: string, countryCode: string = 'TUN'): Observable<CropWindow[]> {
    const normalizedCrop = this.normalizeSearch(crop);
    if (!normalizedCrop) {
      return of([]);
    }

    const faoCountry = countryCode.toUpperCase() === 'TUN' || countryCode.toUpperCase() === 'TN' ? 'TN' : countryCode;

    return this.http.get<FaoCalendarEntry[]>(`${this.faoCropCalendarApi}?countries=${faoCountry}`).pipe(
      map((rows) => {
        const filtered = rows.filter((r) => {
          const name = this.normalizeSearch(r.crop?.name || '');
          return name.includes(normalizedCrop) || r.crop?.id === normalizedCrop;
        });
        const mapped = filtered.flatMap((entry) => this.entryToWindows(entry));
        return mapped.length ? mapped : this.getFallbackCropWindows(normalizedCrop);
      }),
      catchError((error) => {
        console.error('FAO crop calendar fetch failed:', error);
        return of(this.getFallbackCropWindows(normalizedCrop));
      })
    );
  }

  private entryToWindows(entry: FaoCalendarEntry): CropWindow[] {
    const refYear = new Date().getFullYear();
    const out: CropWindow[] = [];
    for (const session of entry.sessions || []) {
      const plantingStart = this.sessionPartToIso(session.early_sowing, refYear);
      const plantingEnd = this.sessionPartToIso(session.later_sowing, refYear);
      const harvestStart = this.sessionPartToIso(session.early_harvest, refYear);
      const harvestEnd = this.sessionPartToIso(session.late_harvest, refYear);
      if (!plantingStart && !plantingEnd && !harvestStart && !harvestEnd) {
        continue;
      }
      out.push({
        crop: entry.crop?.name || '—',
        plantingStart: plantingStart || plantingEnd || '—',
        plantingEnd: plantingEnd || plantingStart || '—',
        harvestStart: harvestStart || harvestEnd || '—',
        harvestEnd: harvestEnd || harvestStart || '—',
        source: 'FAO',
        aezName: entry.aez?.name,
        sessionNotes: session.comments
      });
    }
    return out;
  }

  private sessionPartToIso(part: FaoSowingHarvest | undefined, year: number): string {
    if (!part?.month || !part?.day) {
      return '';
    }
    const m = `${part.month}`.padStart(2, '0');
    const d = `${part.day}`.padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  private aggregateMonthly(
    times: string[],
    tMin: number[],
    tMax: number[],
    precip: number[]
  ): ClimateMonthSummary[] {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets = monthNames.map((month) => ({
      month,
      mins: [] as number[],
      maxs: [] as number[],
      rain: 0
    }));

    for (let i = 0; i < times.length; i++) {
      const date = new Date(times[i]);
      const mi = date.getMonth();
      if (tMin[i] != null && !Number.isNaN(tMin[i])) {
        buckets[mi].mins.push(tMin[i]);
      }
      if (tMax[i] != null && !Number.isNaN(tMax[i])) {
        buckets[mi].maxs.push(tMax[i]);
      }
      buckets[mi].rain += precip[i] ?? 0;
    }

    return buckets.map((b) => ({
      month: b.month,
      avgTempMin: b.mins.length ? Math.round((b.mins.reduce((a, x) => a + x, 0) / b.mins.length) * 10) / 10 : 0,
      avgTempMax: b.maxs.length ? Math.round((b.maxs.reduce((a, x) => a + x, 0) / b.maxs.length) * 10) / 10 : 0,
      totalRainMm: Math.round(b.rain * 10) / 10
    }));
  }

  private normalizeSearch(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private getFallbackCropWindows(crop: string): CropWindow[] {
    const fallback: Record<string, CropWindow> = {
      wheat: {
        crop: 'wheat',
        plantingStart: '2026-10-15',
        plantingEnd: '2026-12-15',
        harvestStart: '2027-05-15',
        harvestEnd: '2027-07-15',
        source: 'Fallback'
      },
      tomato: {
        crop: 'tomato',
        plantingStart: '2026-02-15',
        plantingEnd: '2026-04-15',
        harvestStart: '2026-06-15',
        harvestEnd: '2026-09-30',
        source: 'Fallback'
      },
      olive: {
        crop: 'olive',
        plantingStart: '2026-11-01',
        plantingEnd: '2027-02-28',
        harvestStart: '2026-10-01',
        harvestEnd: '2027-01-31',
        source: 'Fallback'
      },
      ble: {
        crop: 'Blé (approx.)',
        plantingStart: '2026-11-01',
        plantingEnd: '2027-01-15',
        harvestStart: '2027-06-01',
        harvestEnd: '2027-07-15',
        source: 'Fallback',
        sessionNotes: 'Approximation locale — vérifiez les données FAO lorsque la connexion fonctionne.'
      }
    };

    return fallback[crop] ? [fallback[crop]] : [];
  }
}
