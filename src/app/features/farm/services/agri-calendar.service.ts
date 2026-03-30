import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CropWindow, IrrigationAdvice, WeatherForecastDay } from '../models/calendar.model';

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
    et0_fao_evapotranspiration: number[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class AgriCalendarService {
  private readonly openMeteoApi = 'https://api.open-meteo.com/v1/forecast';

  // Optional proxy endpoint for FAO crop calendar integration.
  // Set this to your backend proxy when available.
  private readonly faoCropCalendarProxy = '';

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

  getCropWindows(crop: string, countryCode: string = 'TUN'): Observable<CropWindow[]> {
    const normalizedCrop = (crop || '').trim().toLowerCase();
    if (!normalizedCrop) {
      return of([]);
    }

    if (!this.faoCropCalendarProxy) {
      return of(this.getFallbackCropWindows(normalizedCrop));
    }

    const url = `${this.faoCropCalendarProxy}?country=${countryCode}&crop=${encodeURIComponent(normalizedCrop)}`;
    return this.http.get<CropWindow[]>(url).pipe(
      map((rows) => rows?.length ? rows : this.getFallbackCropWindows(normalizedCrop)),
      catchError((error) => {
        console.error('FAO crop calendar fetch failed:', error);
        return of(this.getFallbackCropWindows(normalizedCrop));
      })
    );
  }

  getTunisiaClimateSources(): { label: string; url: string }[] {
    return [
      { label: 'INM Tunisia (official portal)', url: 'https://www.meteo.tn/' },
      { label: 'Open-Meteo Tunisia forecast map', url: 'https://open-meteo.com/' }
    ];
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
      }
    };

    return fallback[crop] ? [fallback[crop]] : [];
  }
}
