// weather.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface WeatherData {
  location: string;
  region: string;
  country: string;
  forecast: ForecastDay[];
}

export interface ForecastDay {
  date: string;
  day: {
    maxtemp_c: number;
    maxtemp_f: number;
    mintemp_c: number;
    mintemp_f: number;
    avgtemp_c: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    daily_chance_of_rain: number;
    daily_chance_of_snow: number;
    maxwind_kph: number;
    avghumidity: number;
    uv: number;
  };
  astro: {
    sunrise: string;
    sunset: string;
    moonrise: string;
    moonset: string;
  };
  hour: HourlyWeather[];
}

export interface HourlyWeather {
  time: string;
  temp_c: number;
  condition: {
    text: string;
    icon: string;
  };
  wind_kph: number;
  humidity: number;
  feelslike_c: number;
  chance_of_rain: number;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiKey = '30ad58ceb8b34dd6b4d232608262703'; 
  private baseUrl = 'https://api.weatherapi.com/v1';

  constructor(private http: HttpClient) {}

  getForecast(location: string, days: number = 5): Observable<WeatherData> {
    const url = `${this.baseUrl}/forecast.json?key=${this.apiKey}&q=${location}&days=${days}&aqi=no&alerts=no`;
    return this.http.get<any>(url).pipe(
      map(response => ({
        location: response.location.name,
        region: response.location.region,
        country: response.location.country,
        forecast: response.forecast.forecastday.map((day: any) => ({
          date: day.date,
          day: {
            maxtemp_c: day.day.maxtemp_c,
            maxtemp_f: day.day.maxtemp_f,
            mintemp_c: day.day.mintemp_c,
            mintemp_f: day.day.mintemp_f,
            avgtemp_c: day.day.avgtemp_c,
            condition: {
              text: day.day.condition.text,
              icon: day.day.condition.icon,
              code: day.day.condition.code
            },
            daily_chance_of_rain: day.day.daily_chance_of_rain,
            daily_chance_of_snow: day.day.daily_chance_of_snow,
            maxwind_kph: day.day.maxwind_kph,
            avghumidity: day.day.avghumidity,
            uv: day.day.uv
          },
          astro: {
            sunrise: day.astro.sunrise,
            sunset: day.astro.sunset,
            moonrise: day.astro.moonrise,
            moonset: day.astro.moonset
          },
          hour: day.hour.map((hour: any) => ({
            time: hour.time,
            temp_c: hour.temp_c,
            condition: {
              text: hour.condition.text,
              icon: hour.condition.icon
            },
            wind_kph: hour.wind_kph,
            humidity: hour.humidity,
            feelslike_c: hour.feelslike_c,
            chance_of_rain: hour.chance_of_rain
          }))
        }))
      }))
    );
  }
}