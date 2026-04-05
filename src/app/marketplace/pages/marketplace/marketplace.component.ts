import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { LocationService } from '../../../services/location/location.service';
import { DisponibiliteService } from '../../../services/disponibilite/disponibilite.service';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
@Component({
  selector: 'app-marketplace',
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.css']
})
export class MarketplaceComponent implements OnInit {

  
  searchTerm: string = '';
selectedCategory: string = '';
maxPrice: number = 1000;
hasActiveReservations = false;

rentFormStep: 1 | 2 = 1;

showReservationPopup = false;
reservationPopupTitle = '';
reservationPopupMessage = '';
reservationPopupType: 'success' | 'error' = 'success';

currentUserId = 1; //  later replace with auth

isEditMode = false;
selectedProductId: number | null = null;

rentalStep: 'choice' | 'form' = 'choice';
rentItems: any[] = [];
filteredItems: any[] = [];

  mode: 'buy' | 'rent' = 'buy';

  items: any[] = [];

  showForm = false;

  blockedSlots: any[] = [];


  weekAvailability = [
  { jourSemaine: 'LUNDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'MARDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'MERCREDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'JEUDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'VENDREDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'SAMEDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'DIMANCHE', active: false, heureDebut: '', heureFin: '' }
];
  

  mapJourSemaine(day: string): string {
  const map: any = {
    Monday: 'LUNDI',
    Tuesday: 'MARDI',
    Wednesday: 'MERCREDI',
    Thursday: 'JEUDI',
    Friday: 'VENDREDI',
    Saturday: 'SAMEDI',
    Sunday: 'DIMANCHE'
  };

  return map[day] || day;
}

  newProduct: any = {
    nom: '',
    description: '',
    prix: 0,
    quantiteDisponible: 0,
    photoProduit: '',
    idUser: 1
  };

  imagePreview: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;

  constructor(
    private router: Router,
    private productService: ProductService,
    private locationService: LocationService,
    private disponibiliteService: DisponibiliteService,
    private reservationVisiteService: ReservationVisiteService   
  ) {}

  //LOAD PRODUCTS FROM BACKEND
  ngOnInit() {
    this.loadProducts();
    this.loadRentItems();
  }

  loadProducts() {
  this.productService.getAll().subscribe((data: any) => {

    console.log('FULL RESPONSE:', data);

    const produits = data?._embedded?.produitAgricoles;

    if (!produits) {
      console.error('No produits found in response');
      return;
    }

    console.log('PRODUCT ARRAY:', produits);

    this.items = produits.map((p: any) => ({
      id: this.extractId(p._links.self.href),
      name: p.nom,
      type: 'Product',
      price: p.prix,
      image: p.photoProduit
  ? 'http://localhost:8090/uploads/' + p.photoProduit
  : 'assets/images/product1.jpg',
      description: p.description,
      quantity: p.quantiteDisponible,
      idUser: p.idUser
    }));

    console.log('FINAL ITEMS:', this.items);
    this.filteredItems = this.items;
  });
}
extractId(url: string): number {
  return Number(url.split('/').pop());
}
  // 🪟 FORM
  openForm() {
   this.showForm = true;
  document.body.style.overflow = 'hidden';

  if (this.mode === 'rent') {
    this.rentalStep = 'choice';
    this.rentFormStep = 1;
  }
  }

  selectRentalType(type: 'machine' | 'terrain') {
  this.newProduct.type = type;
  this.rentalStep = 'form';
  this.rentFormStep = 1;
}
  closeForm() {
  this.showForm = false;
  document.body.style.overflow = 'auto';
  this.rentalStep = 'choice';
  this.rentFormStep = 1;
  this.resetForm();
  }

  resetForm() {
    this.newProduct = {
      nom: '',
      description: '',
      prix: 0,
      quantiteDisponible: 0,
      photoProduit: '',
      idUser: 1
    };
    this.imagePreview = null;
    this.selectedFile = null;
    this.weekAvailability = [
  { jourSemaine: 'LUNDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'MARDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'MERCREDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'JEUDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'VENDREDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'SAMEDI', active: false, heureDebut: '', heureFin: '' },
  { jourSemaine: 'DIMANCHE', active: false, heureDebut: '', heureFin: '' }
];
  }

  applyFilters() {
  this.filteredItems = this.items.filter(p => {

    const matchesSearch =
      p.name.toLowerCase().includes(this.searchTerm.toLowerCase());

    const matchesPrice =
      p.price <= this.maxPrice;

    const matchesCategory =
      this.selectedCategory === '' || p.type === this.selectedCategory;

    return matchesSearch && matchesPrice && matchesCategory;
  });
}
  onSearchChange() {
  this.applyFilters();
  }

  onPriceChange() {
    this.applyFilters();
  }

  selectCategory(cat: string) {
    this.selectedCategory = cat;
    this.applyFilters();
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

  saveProduct() {

  // ============================
  // 🔥 RENT MODE
  // ============================
  if (this.mode === 'rent') {

    // ✅ VALIDATION (common for create + edit)
    const hasAtLeastOneDay = this.weekAvailability.some(
      d => d.active && d.heureDebut && d.heureFin
    );

    if (!hasAtLeastOneDay) {
      this.openReservationPopup(
        'Availability Failed',
        'Please add at least one weekly availability.',
        'error'
      );
      return;
    }

    if (this.hasInvalidAvailabilities()) {
      this.openReservationPopup(
        'Availability Failed',
        'Each availability must be exactly 1 hour and between 07:00 and 19:00.',
        'error'
      );
      return;
    }

    // ============================
    // ✏️ EDIT MODE (RENT)
    // ============================
    if (this.isEditMode && this.selectedProductId) {

      let updatedRental: any = {
        idUser: this.currentUserId
      };

      // 🔒 ONLY IF NO RESERVATIONS
      if (!this.hasActiveReservations) {
        updatedRental.prix = this.newProduct.prix;
        updatedRental.dateDebutLocation = this.newProduct.dateDebutLocation;
        updatedRental.dateFinLocation = this.newProduct.dateFinLocation;
      }

      if (this.newProduct.type === 'machine') {
        updatedRental = {
          ...updatedRental,
          nom: this.newProduct.nom,
          marque: this.newProduct.marque,
          modele: this.newProduct.modele,
          etat: this.newProduct.etat,
          type: 'materiel'
        };
      } else {
        updatedRental = {
          ...updatedRental,
          localisation: this.newProduct.localisation,
          superficie: this.newProduct.superficie,
          uniteSuperficie: this.newProduct.uniteSuperficie,
          typeSol: this.newProduct.typeSol,
          type: 'terrain'
        };
      }

      this.locationService.update(this.selectedProductId!, updatedRental)
  .subscribe({
    next: () => {

      const locationHref = `http://localhost:8089/Vente/api/location/${this.selectedProductId!}`;
      const disponibilites = this.buildDisponibilites(locationHref);

      // 🔥 ONLY UPDATE AVAILABILITY IF EXISTS
      if (disponibilites.length > 0) {

            this.disponibiliteService.updateForLocation(
              this.selectedProductId!,
              disponibilites
            ).subscribe({
              next: () => {
                this.loadRentItems();
                this.closeForm();

                this.isEditMode = false;
                this.selectedProductId = null;
              },
              error: (err) => {
                console.error('Availability update failed', err);

                // 👉 still close form even if availability fails
                this.loadRentItems();
                this.closeForm();

                this.isEditMode = false;
                this.selectedProductId = null;
              }
            });

          } else {

            // 🔥 NO AVAILABILITY → JUST FINISH
            this.loadRentItems();
            this.closeForm();

            this.isEditMode = false;
            this.selectedProductId = null;
          }

        },
        error: (err) => {
          this.openReservationPopup(
            'Update Blocked',
            err.error?.message || 'Cannot update rental',
            'error'
          );
        }
      });

    return;
    }

    // ============================
    // ➕ CREATE MODE (RENT)
    // ============================
    if (!this.selectedFile) {
      console.error('No image selected');
      return;
    }

    this.productService.uploadImage(this.selectedFile).subscribe({
      next: (fileName: any) => {

        let rental: any = {
          idUser: this.currentUserId,
          prix: this.newProduct.prix,
          image: fileName,
          dateDebutLocation: this.newProduct.dateDebutLocation,
          dateFinLocation: this.newProduct.dateFinLocation,
          disponibilite: true
        };

        if (this.newProduct.type === 'machine') {
          rental = {
            ...rental,
            nom: this.newProduct.nom,
            marque: this.newProduct.marque,
            modele: this.newProduct.modele,
            etat: this.newProduct.etat?.toLowerCase(),
            type: 'materiel'
          };
        } else {
          rental = {
            ...rental,
            localisation: this.newProduct.localisation,
            superficie: this.newProduct.superficie,
            typeSol: this.newProduct.typeSol,
            uniteSuperficie: this.newProduct.uniteSuperficie,
            type: 'terrain'
          };
        }

        console.log('Sending rental:', rental);

        this.locationService.create(rental).subscribe({
          next: (createdLocation: any) => {

            const locationHref = `http://localhost:8089/Vente/api/location/${createdLocation.id}`;
            const disponibilites = this.buildDisponibilites(locationHref);

            if (disponibilites.length === 0) {
              this.loadRentItems();
              this.closeForm();
              return;
            }

            this.disponibiliteService.createMany(disponibilites).subscribe({
              next: () => {
                console.log('Availabilities saved');
                this.loadRentItems();
                this.closeForm();
              },
              error: (err) => {
                console.error('Disponibilite save error', err);
              }
            });

          },
          error: (err) => {
            console.error('ERROR FROM BACKEND', err);
          }
        });

      },
      error: (err) => {
        console.error('Upload failed:', err);
      }
    });

    return;
  }

  // ============================
  // 🛒 BUY MODE (UNCHANGED)
  // ============================

  // ✏️ EDIT PRODUCT
  if (this.isEditMode && this.selectedProductId) {

    if (this.selectedFile) {

      this.productService.uploadImage(this.selectedFile).subscribe({
        next: (fileName: any) => {
          this.updateProduct(fileName);
        },
        error: (err) => {
          console.error('Upload failed:', err);
        }
      });

    } else {

      this.updateProduct(this.newProduct.photoProduit);
    }

  }

  // ➕ CREATE PRODUCT
  else {

    if (!this.selectedFile) {
      console.error('No image selected');
      return;
    }

    this.productService.uploadImage(this.selectedFile).subscribe({
      next: (fileName: any) => {

        const product = {
          nom: this.newProduct.nom,
          description: this.newProduct.description,
          prix: this.newProduct.prix,
          quantiteDisponible: this.newProduct.quantiteDisponible,
          photoProduit: fileName,
          idUser: this.currentUserId
        };

        this.productService.create(product).subscribe(() => {
          this.loadProducts();
          this.closeForm();
        });

      },
      error: (err) => {
        console.error('Upload failed:', err);
      }
    });

  }
}

updateProduct(fileName: string) {

  const updatedProduct = {
    nom: this.newProduct.nom,
    description: this.newProduct.description,
    prix: this.newProduct.prix,
    quantiteDisponible: this.newProduct.quantiteDisponible,
    photoProduit: fileName, // ✅ ALWAYS CLEAN
    idUser: this.currentUserId
  };

  this.productService.update(this.selectedProductId!, updatedProduct)
    .subscribe(() => {

      console.log('Product updated');

      this.loadProducts();
      this.closeForm();

      this.isEditMode = false;
      this.selectedProductId = null;
    });
}

  viewProduct(item: any) {
  const targetMode: 'buy' | 'rent' = this.mode === 'rent' ? 'rent' : 'buy';
  this.router.navigate(['/marketplace', targetMode, item.id]);
}

  // 🛒 ACTION
  action(item: any) {
    if (this.mode === 'buy') {
      console.log('Add to cart', item);
    } else {
      console.log('Book rental', item);
    }
  }

  // 📸 IMAGE HANDLING
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files.length) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  handleFile(file: File) {
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result;
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.selectedFile = null;
    this.imagePreview = null;
  }

editProduct(p: any) {

  this.isEditMode = true;
  this.selectedProductId = p.id;

  // 🔥 always start from step 1
  this.rentalStep = 'form';
  this.rentFormStep = 1;

  // 🔥 reset blocked slots
  this.blockedSlots = [];

  if (this.mode === 'rent' && p.hasReservation) {
    this.openReservationPopup(
      'Limited Editing',
      'This rental has active reservations. Only some fields can be edited.',
      'error'
    );
  }

  if (this.mode === 'rent') {

    // 🔥 SET TYPE
    this.newProduct.type = p.type === 'terrain' ? 'terrain' : 'machine';

    // 🔥 FILL FORM
    this.newProduct = {
      ...this.newProduct,
      nom: p.name,
      prix: p.price,
      idUser: p.idUser,

      // machine
      marque: p.brand,
      modele: p.model,
      etat: p.condition,

      // terrain
      localisation: p.location,
      superficie: p.surface,
      uniteSuperficie: p.unit,
      typeSol: p.soilType,

      dateDebutLocation: p.startDate,
      dateFinLocation: p.endDate
    };

    this.imagePreview = p.image;

    // 🔥 check reservation flag
    this.locationService.hasActiveReservations(p.id)
      .subscribe(res => {
        this.hasActiveReservations = res;
      });

    // ============================
    // 🔥 LOAD DISPONIBILITES
    // ============================
    this.locationService.getDisponibilitesByLocation(p.id)
      .subscribe((dispos: any[]) => {

        console.log('DISPOS FROM BACK:', dispos);

        // reset
        this.weekAvailability = this.weekAvailability.map(day => ({
          ...day,
          active: false,
          heureDebut: '',
          heureFin: ''
        }));

        // fill
        dispos.forEach(d => {

          const found = this.weekAvailability.find(
            day => day.jourSemaine === d.jourSemaine
          );

          if (found) {
            found.active = true;
            found.heureDebut = d.heureDebut?.substring(0, 5);
            found.heureFin = d.heureFin?.substring(0, 5);
          }
        });

      });

    // ============================
    // 🔥 LOAD BLOCKED SLOTS
    // ============================
    this.reservationVisiteService.getReservationsByLocation(p.id)
  .subscribe((reservations: any[]) => {

    this.blockedSlots = reservations
      .filter(r => r.statut === 'EN_ATTENTE')
      .map(r => ({
        jour: this.getDayFromDate(r.dateVisite),
        heureDebut: r.heureDebut.substring(0, 5),
        heureFin: r.heureFin.substring(0, 5)
      }));

    // 🔥 FORCE CHANGE DETECTION
    this.weekAvailability = [...this.weekAvailability];
  });

  }

  // ============================
  // 🛒 BUY MODE
  // ============================
  else {

    this.newProduct = {
      nom: p.name,
      description: p.description,
      prix: p.price,
      quantiteDisponible: p.quantity,
      photoProduit: this.extractFileName(p.image),
      idUser: p.idUser
    };

    this.imagePreview = p.image;
  }

  this.showForm = true;
}
getDayFromDate(dateStr: string): string {
  const date = new Date(dateStr);

  const days = [
    'DIMANCHE',
    'LUNDI',
    'MARDI',
    'MERCREDI',
    'JEUDI',
    'VENDREDI',
    'SAMEDI'
  ];

  return days[date.getDay()];
}
isSlotBlocked(day: any): boolean {

  if (!day.heureDebut || !day.heureFin) return false;

  return this.blockedSlots.some(slot => {

    if (slot.jour !== day.jourSemaine) return false;

    const start1 = slot.heureDebut;
    const end1 = slot.heureFin;

    const start2 = day.heureDebut;
    const end2 = day.heureFin;

    return start2 < end1 && end2 > start1;
  });
}
  extractFileName(url: string): string {
    return url.split('/').pop() || '';
  }

  removeAvailability(day: any) {

  if (this.isSlotBlocked(day)) {
    this.openReservationPopup(
      'Cannot delete',
      'This time slot is already reserved and cannot be removed.',
      'error'
    );
    return;
  }

  // 🔥 CLEAR SLOT
  day.active = false;
  day.heureDebut = '';
  day.heureFin = '';
}

  deleteProduct(p: any) {

    const confirmDelete = confirm(`Delete "${p.name}" ?`);
    if (!confirmDelete) return;

    // 🔥 RENT MODE
    if (this.mode === 'rent') {

      this.locationService.delete(p.id).subscribe({
        next: () => {
          console.log('Rental deleted');

          this.loadRentItems(); // 🔥 refresh rentals
        },
        error: (err) => {
          console.error('Delete error:', err);

          this.openReservationPopup(
            'Delete Blocked',
            err.error?.message || 'Cannot delete this rental (active reservations exist).',
            'error'
          );
        }
      });

      return;
    }

    // 🛒 BUY MODE (unchanged)
    this.productService.delete(p.id).subscribe({
      next: () => {
        console.log('Product deleted');

        this.loadProducts(); // 🔥 refresh products
      },
      error: (err) => {
        console.error('Delete error:', err);
      }
    });
  }

  loadRentItems() {
  this.locationService.getAll().subscribe((data: any) => {

    console.log('RENT RESPONSE:', data);

    let locations: any[] = [];

    if (data._embedded?.locations) {
      locations = data._embedded.locations;
    } else if (data.content) {
      locations = data.content;
    } else if (Array.isArray(data)) {
      locations = data;
    }

    this.rentItems = locations.map((r: any) => ({
      id: r.id ?? this.extractId(r._links?.self?.href),
      name: r.nom || (r.type === 'terrain' ? 'Land Rental' : 'Machine Rental'),
      price: r.prix,
      type: r.type,
      image: r.image && r.image !== 'null'
  ? 'http://localhost:8090/uploads/' + r.image
  : 'assets/images/product1.jpg',
      idUser: r.idUser,
      brand: r.marque,
      model: r.modele,
      condition: r.etat,
      startDate: r.dateDebutLocation,
      endDate: r.dateFinLocation,
      location: r.localisation,
      surface: r.superficie,
      unit: r.uniteSuperficie,
      soilType: r.typeSol,
      hasReservation: false
    }));

    if (this.mode === 'rent') {
      this.filteredItems = this.rentItems;
    }
    this.rentItems.forEach(item => {
  this.locationService.hasActiveReservations(item.id)
    .subscribe(res => item.hasReservation = res);
});
  });
}


  setMode(mode: 'buy' | 'rent') {
  this.mode = mode;

  if (mode === 'buy') {
    this.filteredItems = this.items;
  } else {
    this.filteredItems = this.rentItems;
  }
  }

buildDisponibilites(locationHref: string) {
  const locationId = this.extractIdFromHref(locationHref);

  return this.weekAvailability
    .filter(day =>
      day.active &&
      day.heureDebut &&
      day.heureFin &&
      this.isTimeRangeValid(day.heureDebut, day.heureFin)
    )
    .map(day => ({
      estActive: true,
      heureDebut: day.heureDebut + ':00',
      heureFin: day.heureFin + ':00',
      jourSemaine: this.mapJourSemaine(day.jourSemaine),
      location: {
        id: locationId
      }
    }));
}
  extractIdFromHref(href: string): number {
  return Number(href.split('/').pop());
}

isTimeRangeValid(start: string, end: string): boolean {
  if (!start || !end) return false;

  const startHour = Number(start.split(':')[0]);
  const startMinute = Number(start.split(':')[1] || '0');

  const endHour = Number(end.split(':')[0]);
  const endMinute = Number(end.split(':')[1] || '0');

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  const minAllowed = 7 * 60;   // 07:00
  const maxAllowed = 19 * 60;  // 19:00

  const isExactlyOneHour = endTotal - startTotal === 60;
  const isWithinBounds = startTotal >= minAllowed && endTotal <= maxAllowed;

  return isExactlyOneHour && isWithinBounds;
}

hasInvalidAvailabilities(): boolean {
  return this.weekAvailability.some(day =>
    day.active &&
    (!day.heureDebut || !day.heureFin || !this.isTimeRangeValid(day.heureDebut, day.heureFin))
  );
}

}