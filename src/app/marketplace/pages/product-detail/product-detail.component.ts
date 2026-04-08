import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { LocationService } from '../../../services/location/location.service';
import { DisponibiliteService } from '../../../services/disponibilite/disponibilite.service';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
import { CartService } from '../../../services/cart/cart.service';
import { AuthService } from '../../../services/auth/auth.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit {


  mode: 'buy' | 'rent' = 'buy';

  product: any = {
    name: '',
    price: 0,
    image: '',
    description: '',
    quantity: 0,
    brand: '',
    model: '',
    condition: '',
    startDate: '',
    endDate: '',
    location: '',
    surface: '',
    unit: '',
    soilType: '',
    type: ''
  };

  bookingOpen = false;

availabilities: any[] = [];
filteredAvailabilities: any[] = [];

reservationPopupType: 'success' | 'error' = 'success';

selectedDay = '';
selectedDate = '';
selectedSlot: any = null;
isOwner = false;

daysOfWeek = [
  { label: 'Monday', value: 'LUNDI' },
  { label: 'Tuesday', value: 'MARDI' },
  { label: 'Wednesday', value: 'MERCREDI' },
  { label: 'Thursday', value: 'JEUDI' },
  { label: 'Friday', value: 'VENDREDI' },
  { label: 'Saturday', value: 'SAMEDI' },
  { label: 'Sunday', value: 'DIMANCHE' }
];

  showReservationPopup = false;
  reservationPopupTitle = '';
  reservationPopupMessage = '';

  currentUserId: number | null = null;
  bookingSuccess = false;
  bookingSuccessMessage = '';


  showQuantitySelector = false;
  selectedQuantity = 1;
  cartTotal = 0;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private locationService: LocationService,
    private disponibiliteService: DisponibiliteService,
    private reservationVisiteService: ReservationVisiteService,
    private cartService: CartService,
    private authService: AuthService,
    private location: Location
  ) {}

  ngOnInit() {
    this.currentUserId = this.authService.getCurrentUserId();
  const id = this.route.snapshot.paramMap.get('id');
  const mode = this.route.snapshot.paramMap.get('mode');

  this.mode = mode === 'rent' ? 'rent' : 'buy';

  if (!id) return;

  if (this.mode === 'buy') {
    this.loadProduct(+id);
  } else {
    this.loadRental(+id);
  }
}
extractId(url: string): number {
  return Number(url.split('/').pop());
}

  loadProduct(id: number) {
    
    this.productService.getById(id).subscribe((p: any) => {
      this.product = {
        id: this.extractId(p._links.self.href),
        name: p.nom,
        price: p.prix,
        image: p.photoProduit
          ? 'http://localhost:8090/uploads/' + p.photoProduit
          : 'assets/images/product1.jpg',
        description: p.description,
        quantity: p.quantiteDisponible
      };
      this.isOwner = p.idUser === this.currentUserId;
    });
  }

  loadRental(id: number) {
  this.locationService.getById(id).subscribe((r: any) => {
    this.product = {
      id: id,
      name: r.nom || (r.type === 'terrain' ? 'Land Rental' : 'Machine Rental'),
      price: r.prix,
      image: r.image
        ? 'http://localhost:8090/uploads/' + r.image
        : 'assets/images/product1.jpg',
      description: r.type === 'materiel'
        ? 'Agricultural machine available for rent.'
        : 'Agricultural land available for rent.',
      quantity: 0,
      brand: r.marque,
      model: r.modele,
      condition: r.etat,
      startDate: r.dateDebutLocation,
      endDate: r.dateFinLocation,
      location: r.localisation,
      surface: r.superficie,
      unit: r.uniteSuperficie,
      soilType: r.typeSol,
      type: r.type,
      idUser: r.idUser,
      hasReservation: r.hasActiveReservations
    };
    this.isOwner = r.idUser === this.currentUserId;

    this.loadAvailabilities(id);
  });
}
loadAvailabilities(locationId: number) {
  this.disponibiliteService.getAll().subscribe((data: any) => {
    let dispos: any[] = [];

    if (data._embedded?.disponibilites) {
      dispos = data._embedded.disponibilites;
    } else if (Array.isArray(data)) {
      dispos = data;
    } else if (data.content) {
      dispos = data.content;
    }

    this.availabilities = dispos.filter((d: any) => {
      const href = d._links?.location?.href || '';
      return href.endsWith('/' + locationId);
    });

    console.log('Rental availabilities:', this.availabilities);
  });
}
openReservationPopup(title: string, message: string, type: 'success' | 'error' = 'success') {
  
  this.reservationPopupTitle = title;
  this.reservationPopupMessage = message;
  this.reservationPopupType = type;
  this.showReservationPopup = true;
}

closeReservationPopup() {
  this.showReservationPopup = false;
}
openBooking() {
  if (!this.currentUserId) {
  this.openReservationPopup(
    'Login Required',
    'Please sign in first to book a visit.',
    'error'
  );
  return;
}
  this.bookingOpen = true;
  this.bookingSuccess = false;
  this.bookingSuccessMessage = '';
  this.selectedDay = '';
  this.selectedDate = '';
  this.selectedSlot = null;
  this.filteredAvailabilities = [];
}

selectDay(day: string) {
  this.selectedDay = day;
  this.selectedSlot = null;

  this.disponibiliteService
    .getByLocationAndDay(this.product.id, day)
    .subscribe({
      next: (data: any[]) => {
        this.filteredAvailabilities = data;
      },
      error: (err) => {
        console.error('Error loading availabilities:', err);
      }
    });
}

selectSlot(slot: any) {
  this.selectedSlot = slot;
}

confirmBooking() {
  if (!this.currentUserId) {
  this.openReservationPopup(
    'Login Required',
    'Please sign in first to reserve a visit.',
    'error'
  );
  return;
}
  if (!this.product?.id) {
    this.openReservationPopup(
      'Reservation Failed',
      'Rental not found.',
      'error'
    );
    return;
  }

  if (!this.selectedDay) {
    this.openReservationPopup(
      'Reservation Failed',
      'Please choose a day.',
      'error'
    );
    return;
  }

  if (!this.selectedDate) {
    this.openReservationPopup(
      'Reservation Failed',
      'Please choose a visit date.',
      'error'
    );
    return;
  }

  if (!this.selectedSlot) {
    this.openReservationPopup(
      'Reservation Failed',
      'Please choose a time slot.',
      'error'
    );
    return;
  }

  if (!this.isSelectedDateMatchingDay()) {
    this.openReservationPopup(
      'Reservation Failed',
      'Selected date does not match the chosen day.',
      'error'
    );
    return;
  }

  if (!this.isSelectedDateWithinRentalPeriod()) {
    this.openReservationPopup(
      'Reservation Failed',
      'Selected date must be between rental start date and rental end date.',
      'error'
    );
    return;
  }

  this.reservationVisiteService.getByUser(this.currentUserId).subscribe({
    next: (reservations: any) => {
      const reservationList = Array.isArray(reservations) ? reservations : [];

      if (this.hasAlreadyReservedThisProduct(reservationList)) {
        this.openReservationPopup(
          'Reservation Failed',
          'Product already reserved. You cannot reserve the same product multiple times.',
          'error'
        );
        return;
      }

      const reservation = {
        dateVisite: this.selectedDate,
        heureDebut: this.selectedSlot.heureDebut,
        heureFin: this.selectedSlot.heureFin
      };

      console.log('Reservation payload:', reservation);

      this.reservationVisiteService.create(this.product.id, this.currentUserId!, reservation).subscribe({
        next: () => {
          this.openReservationPopup(
            'Reservation Sent',
            'Thanks for your reservation. Please wait for the farmer to confirm or deny your request.'
          );
          this.bookingOpen = false;
        },
        error: (err) => {
          console.error('Reservation error:', err);

          const backendMessage =
            err?.error?.message ||
            err?.error ||
            'This reservation could not be completed. The selected slot may already be booked or unavailable.';

          this.openReservationPopup(
            'Reservation Failed',
            String(backendMessage),
            'error'
          );
        }
      });
    },
    error: (err) => {
      console.error('Error loading user reservations:', err);
      this.openReservationPopup(
        'Reservation Failed',
        'Unable to verify existing reservations.',
        'error'
      );
    }
  });
}

isSelectedDateMatchingDay(): boolean {
  if (!this.selectedDate || !this.selectedDay) return false;

  const jsDay = new Date(this.selectedDate).getDay();

  const map: any = {
    DIMANCHE: 0,
    LUNDI: 1,
    MARDI: 2,
    MERCREDI: 3,
    JEUDI: 4,
    VENDREDI: 5,
    SAMEDI: 6
  };

  return jsDay === map[this.selectedDay];
}

  
  isSelectedDateWithinRentalPeriod(): boolean {
  if (!this.selectedDate || !this.product?.startDate || !this.product?.endDate) {
    return true;
  }

  const selected = new Date(this.selectedDate);
  const start = new Date(this.product.startDate);
  const end = new Date(this.product.endDate);

  selected.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return selected >= start && selected <= end;
}
hasAlreadyReservedThisProduct(reservations: any[]): boolean {
  return reservations.some((r: any) => {
    const reservedLocationId =
      r.location?.id ||
      r.locationId ||
      r.idLocation;

    return reservedLocationId === this.product.id;
  });
}
openQuantitySelector(): void {
  if (!this.currentUserId) {
  this.openReservationPopup(
    'Login Required',
    'Please sign in first to add products to cart.',
    'error'
  );
  return;
}
  if (this.mode !== 'buy') return;

  if (!this.product?.id) {
    this.openReservationPopup('Cart Error', 'Product not found.', 'error');
    return;
  }

  if (!this.product?.quantity || this.product.quantity <= 0) {
    this.openReservationPopup('Out of Stock', 'This product is currently unavailable.', 'error');
    return;
  }

  this.showQuantitySelector = true;
  this.selectedQuantity = 1;
  this.updateCartTotal();
}
increaseQuantity(): void {
  if (this.selectedQuantity < (this.product?.quantity || 0)) {
    this.selectedQuantity++;
    this.updateCartTotal();
  }
}

decreaseQuantity(): void {
  if (this.selectedQuantity > 1) {
    this.selectedQuantity--;
    this.updateCartTotal();
  }
}

cancelQuantitySelection(): void {
  this.showQuantitySelector = false;
  this.selectedQuantity = 1;
  this.cartTotal = 0;
}

updateCartTotal(): void {
  this.cartTotal = (this.product?.price || 0) * this.selectedQuantity;
}
addProductToCart(): void {
  if (!this.currentUserId) {
  this.openReservationPopup(
    'Login Required',
    'Please sign in first to add products to cart.',
    'error'
  );
  return;
}
  if (!this.product?.id) {
    this.openReservationPopup('Cart Error', 'Product not found.', 'error');
    return;
  }

  if (!this.selectedQuantity || this.selectedQuantity <= 0) {
    this.openReservationPopup('Cart Error', 'Please select a valid quantity.', 'error');
    return;
  }

  if (this.selectedQuantity > (this.product?.quantity || 0)) {
    this.openReservationPopup(
      'Stock Error',
      `Only ${this.product?.quantity || 0} KG available.`,
      'error'
    );
    return;
  }

  this.cartService.addToCart(this.currentUserId, this.product.id, this.selectedQuantity)
    .subscribe({
      next: () => {

        this.cartService.refreshCartCount();

        this.openReservationPopup(
          'Added to Cart',
          `${this.selectedQuantity} KG of ${this.product.name} added successfully.`,
          'success'
        );

        this.showQuantitySelector = false;
        this.selectedQuantity = 1;
        this.cartTotal = 0;
      },
      error: (err) => {
        this.openReservationPopup(
          'Cart Error',
          typeof err === 'string' ? err : 'Failed to add product to cart.',
          'error'
        );
      }
    });
}

canBuyProduct(): boolean {
  return this.mode === 'buy' && (this.product?.quantity || 0) > 0;
}

goBack(): void {
  this.location.back();
}
}