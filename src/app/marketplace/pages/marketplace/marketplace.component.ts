import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { LocationService } from '../../../services/location/location.service';
import { DisponibiliteService } from '../../../services/disponibilite/disponibilite.service';
import { ReservationVisiteService } from '../../../services/reservation/reservation-visite.service';
import { AuthService } from '../../../services/auth/auth.service';
import { AiRecipeService } from '../../../services/ai-recipe.service';
import { CartService } from '../../../services/cart/cart.service';
import { ReviewService } from '../../../services/review/review.service';

@Component({
  selector: 'app-marketplace',
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.css']
})
export class MarketplaceComponent implements OnInit {

  currentPage: number = 1;
  itemsPerPage: number = 16;
  searchTerm: string = '';
  selectedCategory: string = '';
  maxPrice: number = 5000;
  hasActiveReservations = false;

  rentFormStep: 1 | 2 = 1;

  showOnlyMine = false;
  selectedBuyCategory: string = '';

  showReservationPopup = false;
  reservationPopupTitle = '';
  reservationPopupMessage = '';
  reservationPopupType: 'success' | 'error' = 'success';

  currentUserId: number | null = null;
  currentUserRole: string | null = null;

  isEditMode = false;
  selectedProductId: number | null = null;

  rentalStep: 'choice' | 'form' = 'choice';
  rentItems: any[] = [];
  filteredItems: any[] = [];

  mode: 'buy' | 'rent' = 'buy';
  items: any[] = [];
  showForm = false;
  blockedSlots: any[] = [];
  loadError: string | null = null;
  isLoadingProducts = false;
  isLoadingRentals = false;

  weekAvailability = [
    {
      jourSemaine: 'LUNDI',
      active: false,
      slots: [
        { heureDebut: '', heureFin: '' }
      ]
    },
    {
      jourSemaine: 'MARDI',
      active: false,
      slots: [
        { heureDebut: '', heureFin: '' }
      ]
    },
    {
      jourSemaine: 'MERCREDI',
      active: false,
      slots: [
        { heureDebut: '', heureFin: '' }
      ]
    },
    {
      jourSemaine: 'JEUDI',
      active: false,
      slots: [
        { heureDebut: '', heureFin: '' }
      ]
    },
    {
      jourSemaine: 'VENDREDI',
      active: false,
      slots: [
        { heureDebut: '', heureFin: '' }
      ]
    },
    {
      jourSemaine: 'SAMEDI',
      active: false,
      slots: [
        { heureDebut: '', heureFin: '' }
      ]
    },
    {
      jourSemaine: 'DIMANCHE',
      active: false,
      slots: [
        { heureDebut: '', heureFin: '' }
      ]
    }
  ];

  newProduct: any = {
    nom: '',
    description: '',
    prix: 0,
    quantiteDisponible: 0,
    photoProduit: '',
    category: '',
    idUser: null
  };

  imagePreview: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;

  showAiAssistant = false;
aiPrompt = '';
aiLoading = false;
aiResult: any = null;

  constructor(
    private router: Router,
    private productService: ProductService,
    private locationService: LocationService,
    private disponibiliteService: DisponibiliteService,
    private reservationVisiteService: ReservationVisiteService,
    private aiRecipeService: AiRecipeService,
    private cartService: CartService,
    private authService: AuthService,
    private reviewService: ReviewService,
  ) {}

  ngOnInit() {
    this.loadConnectedUser();
    this.loadProducts();
    this.loadRentItems();
  }

  loadConnectedUser(): void {
    this.currentUserRole = this.authService.getCurrentRole();

    // Preferred way: from AuthService if you already store the logged user id
    const authUserId =
      (this.authService as any).getCurrentUserId?.() ??
      (this.authService as any).currentUserValue?.id ??
      null;

    if (authUserId !== null && authUserId !== undefined) {
      this.currentUserId = Number(authUserId);
      return;
    }

    // Fallback: try localStorage if your auth service stores user info there
    const storedUser =
      localStorage.getItem('currentUser') ||
      localStorage.getItem('user') ||
      localStorage.getItem('authUser');

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        this.currentUserId = Number(parsed.id ?? parsed.userId ?? parsed.idUser ?? null);
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }
  }

  get isAgriculteur(): boolean {
    return this.currentUserRole === 'AGRICULTEUR' || this.currentUserRole === 'Farmer';
  }

  canManageItem(item: any): boolean {
    return !!this.currentUserId && this.isAgriculteur && Number(item.idUser) === Number(this.currentUserId);
  }

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

  loadProducts() {
  this.isLoadingProducts = true;
  this.loadError = null;
  this.productService.getAll().subscribe({
    next: (data: any) => {
      this.isLoadingProducts = false;
      const produits = data?._embedded?.produitAgricoles || data || [];

      if (!Array.isArray(produits)) {
        console.error('No produits found in response');
        return;
      }

      this.items = produits.map((p: any) => ({
        id: p.id ?? this.extractId(p._links?.self?.href || ''),
        name: p.nom,
        category: p.category || '',
        type: 'Product',
        price: p.prix,
        image: p.photoProduit
          ? 'http://localhost:8090/uploads/' + p.photoProduit
          : 'assets/images/product1.jpg',
        description: p.description,
        quantity: p.quantiteDisponible,
        idUser: p.idUser,
        averageRating: 0,
        reviewCount: 0
      }));

      this.items.forEach((item: any) => {
        this.reviewService.getReviews('PRODUCT', item.id).subscribe({
          next: (reviews: any[]) => {
            const list = Array.isArray(reviews) ? reviews : [];
            item.reviewCount = list.length;

            if (list.length > 0) {
              const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
              item.averageRating = total / list.length;
            } else {
              item.averageRating = 0;
            }

            this.filteredItems = [...this.items];
          },
          error: () => {
            item.reviewCount = 0;
            item.averageRating = 0;
            this.filteredItems = [...this.items];
          }
        });
      });

      this.filteredItems = [...this.items];
    },
    error: (err: any) => {
      this.isLoadingProducts = false;
      console.error('Failed to load products:', err);
      this.loadError = 'Le service marketplace est temporairement indisponible. Veuillez réessayer plus tard.';
      this.items = [];
      this.filteredItems = [];
    }
  });
}

  extractId(url: string): number {
    return Number(url.split('/').pop());
  }

  openForm() {
    if (!this.currentUserId) {
      this.openReservationPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    if (!this.isAgriculteur) {
      this.openReservationPopup(
        'Access Denied',
        'Only agriculteurs can add products or rentals.',
        'error'
      );
      return;
    }

    this.showForm = true;
    document.body.style.overflow = 'hidden';

    if (this.mode === 'rent') {
      this.rentalStep = 'choice';
      this.rentFormStep = 1;
    }
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
      category: '',
      idUser: this.currentUserId
    };

    this.imagePreview = null;
    this.selectedFile = null;
    this.isEditMode = false;
    this.selectedProductId = null;
    this.hasActiveReservations = false;

    this.weekAvailability = [
  {
    jourSemaine: 'LUNDI',
    active: false,
    slots: [
      { heureDebut: '', heureFin: '' }
    ]
  },
  {
    jourSemaine: 'MARDI',
    active: false,
    slots: [
      { heureDebut: '', heureFin: '' }
    ]
  },
  {
    jourSemaine: 'MERCREDI',
    active: false,
    slots: [
      { heureDebut: '', heureFin: '' }
    ]
  },
  {
    jourSemaine: 'JEUDI',
    active: false,
    slots: [
      { heureDebut: '', heureFin: '' }
    ]
  },
  {
    jourSemaine: 'VENDREDI',
    active: false,
    slots: [
      { heureDebut: '', heureFin: '' }
    ]
  },
  {
    jourSemaine: 'SAMEDI',
    active: false,
    slots: [
      { heureDebut: '', heureFin: '' }
    ]
  },
  {
    jourSemaine: 'DIMANCHE',
    active: false,
    slots: [
      { heureDebut: '', heureFin: '' }
    ]
  }
];
  }

  selectRentalType(type: 'machine' | 'terrain') {
    this.newProduct.type = type;
    this.rentalStep = 'form';
    this.rentFormStep = 1;
  }

  applyFilters() {
    const source = this.mode === 'buy' ? this.items : this.rentItems;

    this.filteredItems = source.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesPrice = p.price <= this.maxPrice;

      const matchesRentCategory =
        this.mode !== 'rent' ||
        this.selectedCategory === '' ||
        p.type?.toLowerCase() === this.selectedCategory.toLowerCase();

      const matchesBuyCategory =
        this.mode !== 'buy' ||
        this.selectedBuyCategory === '' ||
        (p.category || '').toLowerCase() === this.selectedBuyCategory.toLowerCase();

      const matchesMine =
        !this.showOnlyMine || p.idUser === this.currentUserId;

      return matchesSearch && matchesPrice && matchesRentCategory && matchesBuyCategory && matchesMine;

    });
    this.currentPage = 1;
  }

  toggleMyPosts(): void {
  this.showOnlyMine = !this.showOnlyMine;
  this.applyFilters();
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
    if (!this.currentUserId) {
      this.openReservationPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    if (!this.isAgriculteur) {
      this.openReservationPopup(
        'Access Denied',
        'Only agriculteurs can add or edit marketplace items.',
        'error'
      );
      return;
    }

    if (this.mode === 'rent') {
      const hasAtLeastOneDay = this.weekAvailability.some(day =>
        day.active && day.slots.some((slot: any) => slot.heureDebut && slot.heureFin)
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

      if (this.isEditMode && this.selectedProductId) {
        const doRentalUpdate = (imageName?: string) => {
          let updatedRental: any = {
            idUser: this.currentUserId
          };

          if (!this.hasActiveReservations) {
            updatedRental.prix = this.newProduct.prix;
            updatedRental.dateDebutLocation = this.newProduct.dateDebutLocation;
            updatedRental.dateFinLocation = this.newProduct.dateFinLocation;
          }

          if (imageName) {
            updatedRental.image = imageName;
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

          this.locationService.update(this.selectedProductId!, updatedRental).subscribe({
            next: () => {
              const disponibilites = this.buildDisponibilitesForUpdate();

              if (disponibilites.length > 0) {
                this.disponibiliteService.updateForLocation(this.selectedProductId!, disponibilites)
                  .subscribe({
                    next: () => {
                      this.loadRentItems();
                      this.closeForm();
                    },
                    error: (err) => {
                      console.error('Availability update failed', err);
                      this.loadRentItems();
                      this.closeForm();
                    }
                  });
              } else {
                this.loadRentItems();
                this.closeForm();
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
        };

        if (this.selectedFile) {
          this.productService.uploadImage(this.selectedFile).subscribe({
            next: (fileName: any) => doRentalUpdate(fileName),
            error: (err) => {
              console.error('Upload failed:', err);
              this.openReservationPopup('Image Upload Failed', 'Could not upload the new image.', 'error');
            }
          });
        } else {
          doRentalUpdate();
        }

        return;
      }

      if (!this.selectedFile) {
        this.openReservationPopup('Image Required', 'Please select an image.', 'error');
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

          this.locationService.create(rental).subscribe({
            next: (createdLocation: any) => {
              const locationHref = `http://localhost:8089/Vente/api/location/${createdLocation.id}`;
              const disponibilites = this.buildDisponibilites(locationHref);

              console.log('LOCATION HREF:', locationHref);
              console.log('DISPONIBILITES PAYLOAD:', disponibilites);
              if (disponibilites.length === 0) {
                this.loadRentItems();
                this.closeForm();
                return;
              }

              this.disponibiliteService.createMany(disponibilites).subscribe({
                next: () => {
                  this.loadRentItems();
                  this.closeForm();
                },
                error: (err) => console.error('Disponibilite save error', err)
              });
            },
            error: (err) => console.error('ERROR FROM BACKEND', err)
          });
        },
        error: (err) => console.error('Upload failed:', err)
      });

      return;
    }
    if (
      !this.newProduct.nom?.trim() ||
      !this.newProduct.description?.trim() ||
      !this.newProduct.category?.trim() ||
      !this.newProduct.prix ||
      this.newProduct.prix <= 0 ||
      !this.newProduct.quantiteDisponible ||
      this.newProduct.quantiteDisponible <= 0
    ) {
      this.openReservationPopup(
        'Missing Fields',
        'Please fill in all product fields correctly.',
        'error'
      );
      return;
    }

    if (this.isEditMode && this.selectedProductId) {
      if (this.selectedFile) {
        this.productService.uploadImage(this.selectedFile).subscribe({
          next: (fileName: any) => this.updateProduct(fileName),
          error: (err) => console.error('Upload failed:', err)
        });
      } else {
        this.updateProduct(this.newProduct.photoProduit);
      }
    } else {
      if (!this.selectedFile) {
        this.openReservationPopup('Image Required', 'Please select an image.', 'error');
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
            category: this.newProduct.category,
            idUser: this.currentUserId
          };

          this.productService.create(product).subscribe(() => {
            this.loadProducts();
            this.closeForm();
          });
        },
        error: (err) => console.error('Upload failed:', err)
      });
    }
  }

  updateProduct(fileName: string) {
    const updatedProduct = {
      nom: this.newProduct.nom,
      description: this.newProduct.description,
      prix: this.newProduct.prix,
      quantiteDisponible: this.newProduct.quantiteDisponible,
      photoProduit: fileName,
      category: this.newProduct.category,
      idUser: this.currentUserId
    };

    this.productService.update(this.selectedProductId!, updatedProduct).subscribe(() => {
      this.loadProducts();
      this.closeForm();
    });
  }

  viewProduct(item: any) {
    const targetMode: 'buy' | 'rent' = this.mode === 'rent' ? 'rent' : 'buy';
    this.router.navigate(['/marketplace', targetMode, item.id]);
  }

  action(item: any) {
    if (!this.currentUserId) {
      this.openReservationPopup('Login Required', 'Please sign in first.', 'error');
      return;
    }

    if (this.mode === 'buy') {
      console.log('Add to cart', item);
    } else {
      console.log('Book rental', item);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.handleFile(file);
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
    reader.onload = () => this.imagePreview = reader.result;
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.selectedFile = null;
    this.imagePreview = null;
  }

  editProduct(p: any) {
    if (!this.canManageItem(p)) {
      this.openReservationPopup(
        'Access Denied',
        'You can only edit your own items.',
        'error'
      );
      return;
    }

    this.isEditMode = true;
    this.selectedProductId = p.id;
    this.rentalStep = 'form';
    this.rentFormStep = 1;
    this.blockedSlots = [];

    if (this.mode === 'rent' && p.hasReservation) {
      this.openReservationPopup(
        'Limited Editing',
        'This rental has active reservations. Only some fields can be edited.',
        'error'
      );
    }

    if (this.mode === 'rent') {
      this.newProduct.type = p.type === 'terrain' ? 'terrain' : 'machine';

      this.newProduct = {
        ...this.newProduct,
        nom: p.name,
        prix: p.price,
        idUser: p.idUser,
        marque: p.brand,
        modele: p.model,
        etat: p.condition,
        localisation: p.location,
        superficie: p.surface,
        uniteSuperficie: p.unit,
        typeSol: p.soilType,
        dateDebutLocation: p.startDate,
        dateFinLocation: p.endDate
      };

      this.imagePreview = p.image;

      this.locationService.hasActiveReservations(p.id).subscribe(res => {
        this.hasActiveReservations = res;
      });

      this.locationService.getDisponibilitesByLocation(p.id).subscribe((dispos: any[]) => {
        this.weekAvailability = this.weekAvailability.map(day => ({
          ...day,
          active: false,
          slots: []
        }));

        dispos.forEach(d => {
          const found = this.weekAvailability.find(day => day.jourSemaine === d.jourSemaine);

          if (found) {
            found.active = true;
            found.slots.push({
              heureDebut: d.heureDebut?.substring(0, 5),
              heureFin: d.heureFin?.substring(0, 5)
            });
          }
        });

        this.weekAvailability.forEach(day => {
          if (day.active && day.slots.length === 0) {
            day.slots.push({ heureDebut: '', heureFin: '' });
          }
        });
      });

      this.reservationVisiteService.getReservationsByLocation(p.id).subscribe((reservations: any[]) => {
        this.blockedSlots = reservations
          .filter(r => r.statut === 'EN_ATTENTE')
          .map(r => ({
            jour: this.getDayFromDate(r.dateVisite),
            heureDebut: r.heureDebut.substring(0, 5),
            heureFin: r.heureFin.substring(0, 5)
          }));

        this.weekAvailability = [...this.weekAvailability];
      });
    } else {
      this.newProduct = {
        nom: p.name,
        description: p.description,
        prix: p.price,
        quantiteDisponible: p.quantity,
        photoProduit: this.extractFileName(p.image),
        category: p.category || '',
        idUser: p.idUser
      };

      this.imagePreview = p.image;
    }

    this.showForm = true;
  }

  deleteProduct(p: any) {
    if (!this.canManageItem(p)) {
      this.openReservationPopup(
        'Access Denied',
        'You can only delete your own items.',
        'error'
      );
      return;
    }

    const confirmDelete = confirm(`Delete "${p.name}" ?`);
    if (!confirmDelete) return;

    if (this.mode === 'rent') {
      this.locationService.delete(p.id).subscribe({
        next: () => this.loadRentItems(),
        error: (err) => {
          this.openReservationPopup(
            'Delete Blocked',
            err.error?.message || 'Cannot delete this rental (active reservations exist).',
            'error'
          );
        }
      });
      return;
    }

    this.productService.delete(p.id).subscribe({
      next: () => this.loadProducts(),
      error: (err) => console.error('Delete error:', err)
    });
  }

  loadRentItems() {
    this.isLoadingRentals = true;
    this.locationService.getAll().subscribe({
     next: (data: any) => {
      this.isLoadingRentals = false;
      let locations: any[] = [];

      if (data._embedded?.locations) locations = data._embedded.locations;
      else if (data.content) locations = data.content;
      else if (Array.isArray(data)) locations = data;

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
        hasReservation: false,
        averageRating: 0,
        reviewCount: 0
      }));

      this.applyFilters();

      this.rentItems.forEach((item: any) => {
        this.reviewService.getReviews('RENTAL', item.id).subscribe({
          next: (reviews: any[]) => {
            const list = Array.isArray(reviews) ? reviews : [];
            item.reviewCount = list.length;

            if (list.length > 0) {
              const total = list.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
              item.averageRating = total / list.length;
            } else {
              item.averageRating = 0;
            }

            this.filteredItems = [...this.filteredItems];
          },
          error: () => {
            item.reviewCount = 0;
            item.averageRating = 0;
            this.filteredItems = [...this.filteredItems];
          }
        });
      });

      this.rentItems.forEach(item => {
        this.locationService.hasActiveReservations(item.id)
          .subscribe(res => item.hasReservation = res);
      });
    },
    error: (err: any) => {
      this.isLoadingRentals = false;
      console.error('Failed to load rentals:', err);
      this.rentItems = [];
      // Only surface the error and update filteredItems when the user is in rent mode
      if (this.mode === 'rent') {
        this.loadError = 'Le service marketplace est temporairement indisponible. Veuillez réessayer plus tard.';
        this.applyFilters();
      }
    }
    });
  }

  setMode(mode: 'buy' | 'rent') {
    this.mode = mode;
    this.applyFilters();
  }

  getDayFromDate(dateStr: string): string {
    const date = new Date(dateStr);
    const days = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
    return days[date.getDay()];
  }

  isSlotBlocked(day: any, slot: any): boolean {
  if (!slot.heureDebut || !slot.heureFin) return false;

  return this.blockedSlots.some(blocked => {
    if (blocked.jour !== day.jourSemaine) return false;

    const start1 = blocked.heureDebut;
    const end1 = blocked.heureFin;

    const start2 = slot.heureDebut;
    const end2 = slot.heureFin;

    return start2 < end1 && end2 > start1;
  });
}

  extractFileName(url: string): string {
    return url.split('/').pop() || '';
  }

  removeSlot(day: any, index: number) {
  const slot = day.slots[index];

  if (this.isSlotBlocked(day, slot)) {
    this.openReservationPopup(
      'Cannot delete',
      'This time slot is already reserved and cannot be removed.',
      'error'
    );
    return;
  }

  day.slots.splice(index, 1);

  if (day.slots.length === 0) {
    day.slots.push({ heureDebut: '', heureFin: '' });
  }
}

  buildDisponibilites(locationHref: string) {
  return this.weekAvailability.flatMap(day =>
    day.active
      ? day.slots
          .filter((slot: any) =>
            slot.heureDebut &&
            slot.heureFin &&
            this.isTimeRangeValid(slot.heureDebut, slot.heureFin)
          )
          .map((slot: any) => ({
            estActive: true,
            heureDebut: slot.heureDebut + ':00',
            heureFin: slot.heureFin + ':00',
            jourSemaine: this.mapJourSemaine(day.jourSemaine),
            location: locationHref
          }))
      : []
  );
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

    const minAllowed = 7 * 60;
    const maxAllowed = 19 * 60;

    const isExactlyOneHour = endTotal - startTotal === 60;
    const isWithinBounds = startTotal >= minAllowed && endTotal <= maxAllowed;

    return isExactlyOneHour && isWithinBounds;
  }

  hasInvalidAvailabilities(): boolean {
    return this.weekAvailability.some(day =>
      day.active &&
      day.slots.some((slot: any) =>
        !slot.heureDebut ||
        !slot.heureFin ||
        !this.isTimeRangeValid(slot.heureDebut, slot.heureFin)
      )
    );
  }


  addSlot(day: any) {
  day.slots.push({ heureDebut: '', heureFin: '' });
}

buildDisponibilitesForUpdate() {
  return this.weekAvailability.flatMap(day =>
    day.active
      ? day.slots
          .filter((slot: any) =>
            slot.heureDebut &&
            slot.heureFin &&
            this.isTimeRangeValid(slot.heureDebut, slot.heureFin)
          )
          .map((slot: any) => ({
            estActive: true,
            heureDebut: slot.heureDebut + ':00',
            heureFin: slot.heureFin + ':00',
            jourSemaine: this.mapJourSemaine(day.jourSemaine)
          }))
      : []
  );
}

get paginatedItems() {
  const start = (this.currentPage - 1) * this.itemsPerPage;
  return this.filteredItems.slice(start, start + this.itemsPerPage);
}

nextPage() {
  if (this.currentPage * this.itemsPerPage < this.filteredItems.length) {
    this.currentPage++;
  }
}

prevPage() {
  if (this.currentPage > 1) {
    this.currentPage--;
  }
}

toggleAiAssistant() {
  this.showAiAssistant = !this.showAiAssistant;
}

generateRecipe(addToCart: boolean = false) {
  if (!this.currentUserId) {
    this.openReservationPopup('Login Required', 'Please sign in first.', 'error');
    return;
  }

  if (!this.aiPrompt.trim()) {
    this.openReservationPopup('Prompt Required', 'Please write what recipe you want.', 'error');
    return;
  }

  this.aiLoading = true;

  this.aiRecipeService.generateRecipeCart({
    userId: this.currentUserId,
    prompt: this.aiPrompt,
    addToCart
  }).subscribe({
    next: (res) => {
      this.aiResult = res;
      this.aiLoading = false;

      if (addToCart) {
        this.cartService.refreshCartCount();
        this.openReservationPopup(
          'Recipe Cart Ready',
          'Matched ingredients were added to your cart.',
          'success'
        );
      }
    },
    error: (err) => {
      this.aiLoading = false;
      this.openReservationPopup(
        'AI Error',
        err?.error?.message || 'Failed to generate recipe.',
        'error'
      );
    }
  });
}


getStars(rating: number): boolean[] {
  const rounded = Math.round(rating || 0);
  return [1, 2, 3, 4, 5].map(star => star <= rounded);
}
}
