import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Events } from 'src/app/models/events';
import { EventService } from 'src/app/services/event/event.service';
import { WeatherService, WeatherData, ForecastDay } from 'src/app/services/weather/weather.service';
import { ReservationService, Reservation } from 'src/app/services/reservation/reservation.service';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-details-event',
  templateUrl: './details-event.component.html',
  styleUrls: ['./details-event.component.css']
})
export class DetailsEventComponent implements OnInit {
  event!: Events;
  weatherData: WeatherData | null = null;
  forecastDays: ForecastDay[] = [];
  loadingWeather = false;
  weatherError = false;
  weatherInfo: string = '';

  nbPlaceReserve: number = 1;
  bookingLoading = false;
  bookingSuccess = false;
  bookingError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,               
    private eventService: EventService,
    private weatherService: WeatherService,
    private reservationService: ReservationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.eventService.getEventById(id).subscribe((data) => {
      this.event = data;
      this.loadWeather();
    });
  }

  loadWeather(): void {
    const location = `${this.event.lieu}, ${this.event.region}`;
    const days = this.calculateDays();
    this.loadingWeather = true;
    this.weatherError = false;

    this.weatherService.getForecast(location, days).subscribe({
      next: data => {
        this.weatherData = data;
        if (!data.region.includes(this.event.region)) {
          this.weatherInfo = `📍 Showing weather for ${data.location}`;
        }
        this.filterForecast();
        this.loadingWeather = false;
      },
      error: () => {
        this.weatherError = true;
        this.loadingWeather = false;
      }
    });
  }

  calculateDays(): number {
    const today = new Date();
    const end = new Date(this.event.dateFin);
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return Math.min(Math.max(diff + 1, 3), 7);
  }

  filterForecast(): void {
    if (!this.weatherData?.forecast) return;
    const today = this.formatDate(new Date());
    const start = this.formatDate(new Date(this.event.dateDebut));
    const end = this.formatDate(new Date(this.event.dateFin));
    this.forecastDays = this.weatherData.forecast.filter(d =>
      d.date >= start && d.date <= end && d.date >= today
    );
    if (!this.forecastDays.length) {
      this.weatherInfo = '⚠️ No forecast available for these dates';
    }
  }

  get placesRestantes(): number {
    return this.event.capaciteMax - (this.event.inscrits || 0);
  }

  incrementPlaces(): void {
    if (this.nbPlaceReserve < this.placesRestantes) {
      this.nbPlaceReserve++;
    }
  }

  decrementPlaces(): void {
    if (this.nbPlaceReserve > 1) {
      this.nbPlaceReserve--;
    }
  }

  bookEvent(): void {
    if (this.placesRestantes <= 0) return;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.bookingError = 'Vous devez être connecté pour réserver.';
      return;
    }

    if (this.nbPlaceReserve < 1 || this.nbPlaceReserve > this.placesRestantes) {
      this.bookingError = `Nombre de places invalide (1 – ${this.placesRestantes}).`;
      return;
    }

    this.bookingLoading = true;
    this.bookingError = '';
    this.bookingSuccess = false;

    const reservation: Reservation = {
      nbPlaceReserve: this.nbPlaceReserve,
      montant: this.event.montant * this.nbPlaceReserve,
      evenement: { id: this.event.id },
      id_user: currentUser.userId
    };

    this.reservationService.addReservation(reservation).subscribe({
      next: (res) => {                                        
        this.bookingLoading = false;
        this.router.navigate(['/events/payment', res.id]);  
        window.scrollTo(0, 0);          
      },
      error: () => {
        this.bookingLoading = false;
        this.bookingError = 'Error during booking. Please try again.';
      }
    });
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getDayOfWeek(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  }

  getPourcentage(inscrits: number, capacite: number): number {
    return (inscrits || 0) / capacite * 100;
  }

  getCouleur(inscrits: number, capacite: number): string {
    const p = this.getPourcentage(inscrits, capacite);
    if (p === 100) return 'var(--gr-danger)';
    if (p >= 70)  return 'var(--gr-warning)';
    return 'var(--gr-green)';
  }

  getWeatherIcon(iconUrl: string): string {
    if (iconUrl.includes('day')) {
      return iconUrl.replace('//cdn.weatherapi.com/weather/64x64/', '');
    }
    return iconUrl;
  }
}