import { ReservationVisiteService } from './../../services/reservation/reservation-visite.service';
import { AdminOrderService } from './../services/admin-order.service';
import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../marketplace/services/product.service';
import { LocationService } from '../../services/location/location.service';
import { AdminUserService } from '../services/admin-user.service';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
type AdminMarketplaceTab =
  | 'products'
  | 'rentals'
  | 'orders'
  | 'reservations'
  | 'paiement'
  | 'contracts';

@Component({
  selector: 'app-marketplace-admin',
  templateUrl: './marketplace-admin.component.html',
  styleUrls: ['./marketplace-admin.component.css']
})
export class MarketplaceAdminComponent implements OnInit {
  loading = false;

  activeTab: AdminMarketplaceTab = 'products';

  searchTerm = '';

  products: any[] = [];
  filteredProducts: any[] = [];
  paginatedProducts: any[] = [];

  rentals: any[] = [];
  filteredRentals: any[] = [];
  paginatedRentals: any[] = [];

  currentPage = 1;
  pageSize = 6;
  totalPages = 1;


  orders: any[] = [];
  filteredOrders: any[] = [];
  paginatedOrders: any[] = [];

  selectedOrder: any = null;
  showOrderDetails = false;


  reservations: any[] = [];
  filteredReservations: any[] = [];
  paginatedReservations: any[] = [];

  selectedReservationStatus = '';

  selectedOrderStatus = '';

  paidOrders: any[] = [];
  filteredPaidOrders: any[] = [];
  paginatedPaidOrders: any[] = [];

  selectedPaymentStatus = 'VALIDEE';

  paymentStats = {
    totalIncome: 0,
    paidOrdersCount: 0,
    mostBoughtProduct: '—',
    totalProductsSold: 0
  };

  contracts: any[] = [];
  filteredContracts: any[] = [];
  paginatedContracts: any[] = [];

  selectedContractStatus = '';

  constructor(
    private router: Router,
    private productService: ProductService,
    private locationService: LocationService,
    private adminUserService: AdminUserService,
    private adminOrderService: AdminOrderService,
    private reservationVisiteService: ReservationVisiteService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  setTab(tab: AdminMarketplaceTab): void {
    this.activeTab = tab;
    this.searchTerm = '';
    this.currentPage = 1;

    if (tab === 'products' && this.products.length === 0) {
      this.loadProducts();
      return;
    }

    if (tab === 'rentals' && this.rentals.length === 0) {
      this.loadRentals();
      return;
    }

    if (tab === 'orders' && this.orders.length === 0) {
    this.loadOrders();
    return;
    }

    if (tab === 'reservations' && this.reservations.length === 0) {
    this.loadReservations();
    return;
    }

    if (tab === 'paiement' && this.paidOrders.length === 0) {
    this.loadPaidOrders();
    return;
    }


    if (tab === 'contracts' && this.contracts.length === 0) {
    this.loadContracts();
    return;
    }

    this.applyFilter();
  }

  async loadProducts(): Promise<void> {
    this.loading = true;

    this.productService.getAll().subscribe({
      next: async (data: any) => {
        const produits = data?._embedded?.produitAgricoles || data || [];

        this.products = produits.map((p: any) => ({
          id: p.id ?? this.extractId(p._links?.self?.href || ''),
          nom: p.nom,
          description: p.description,
          prix: p.prix,
          quantiteDisponible: p.quantiteDisponible,
          category: p.category,
          photoProduit: p.photoProduit
            ? `http://localhost:8090/uploads/${p.photoProduit}`
            : 'assets/images/product1.jpg',
          idUser: p.idUser,
          userName: 'Loading...'
        }));

        await this.attachUserNames(this.products);
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading products', err);
        this.loading = false;
      }
    });
  }

  async loadRentals(): Promise<void> {
    this.loading = true;

    this.locationService.getAll().subscribe({
      next: async (data: any) => {
        let locations: any[] = [];

        if (data?._embedded?.locations) locations = data._embedded.locations;
        else if (data?.content) locations = data.content;
        else if (Array.isArray(data)) locations = data;

        this.rentals = locations.map((r: any) => ({
          id: r.id ?? this.extractId(r?._links?.self?.href),
          nom: r.nom || (r.type === 'terrain' ? 'Land Rental' : 'Machine Rental'),
          description:
            r.type === 'terrain'
              ? `Land in ${r.localisation || 'Unknown location'}`
              : `${r.marque || 'Machine'} ${r.modele || ''}`.trim(),
          prix: r.prix,
          type: r.type,
          image: r.image && r.image !== 'null'
            ? `http://localhost:8090/uploads/${r.image}`
            : 'assets/images/product1.jpg',
          idUser: r.idUser,
          userName: 'Loading...',
          marque: r.marque,
          modele: r.modele,
          etat: r.etat,
          localisation: r.localisation,
          superficie: r.superficie,
          uniteSuperficie: r.uniteSuperficie,
          typeSol: r.typeSol,
          dateDebutLocation: r.dateDebutLocation,
          dateFinLocation: r.dateFinLocation
        }));

        await this.attachUserNames(this.rentals);
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading rentals', err);
        this.loading = false;
      }
    });
  }

  async attachUserNames(items: any[]): Promise<void> {
    const uniqueUserIds = [...new Set(items.map(item => item.idUser).filter(Boolean))];
    const userMap = new Map<number, string>();

    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        try {
          const user = await firstValueFrom(this.adminUserService.getUserById(userId));
          const fullName =
            `${user?.prenom || ''} ${user?.nom || ''}`.trim() ||
            user?.username ||
            user?.email ||
            `User #${userId}`;

          userMap.set(userId, fullName);
        } catch (e) {
          console.error(`Failed to load user ${userId}`, e);
          userMap.set(userId, `User #${userId}`);
        }
      })
    );

    items.forEach(item => {
      item.userName = userMap.get(item.idUser) || `User #${item.idUser}`;
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();

    if (this.activeTab === 'products') {
      this.filteredProducts = !term
        ? [...this.products]
        : this.products.filter(p =>
            (p.nom || '').toLowerCase().includes(term) ||
            (p.category || '').toLowerCase().includes(term) ||
            (p.userName || '').toLowerCase().includes(term)
          );
    }

    if (this.activeTab === 'rentals') {
      this.filteredRentals = !term
        ? [...this.rentals]
        : this.rentals.filter(r =>
            (r.nom || '').toLowerCase().includes(term) ||
            (r.type || '').toLowerCase().includes(term) ||
            (r.localisation || '').toLowerCase().includes(term) ||
            (r.userName || '').toLowerCase().includes(term)
          );
    }

    if (this.activeTab === 'orders') {
    this.filteredOrders = this.orders.filter(o => {
        const matchesSearch =
        !term ||
        String(o.id).includes(term) ||
        (o.userName || '').toLowerCase().includes(term) ||
        (o.statut || '').toLowerCase().includes(term);

        const matchesStatus =
        !this.selectedOrderStatus ||
        o.statut === this.selectedOrderStatus;

        return matchesSearch && matchesStatus;
    });
    }


    if (this.activeTab === 'reservations') {
        this.filteredReservations = this.reservations.filter(r => {
            const matchesSearch =
            !term ||
            (r.userName || '').toLowerCase().includes(term) ||
            (r.rentalName || '').toLowerCase().includes(term) ||
            (r.statut || '').toLowerCase().includes(term) ||
            String(r.id).includes(term);

            const matchesStatus =
            !this.selectedReservationStatus ||
            r.statut === this.selectedReservationStatus;

            return matchesSearch && matchesStatus;
        });
    }

    if (this.activeTab === 'paiement') {
    this.filteredPaidOrders = !term
        ? [...this.paidOrders]
        : this.paidOrders.filter(o =>
            String(o.id).includes(term) ||
            (o.userName || '').toLowerCase().includes(term) ||
            (o.statut || '').toLowerCase().includes(term)
        );
    }

    if (this.activeTab === 'contracts') {
    this.filteredContracts = !term
        ? [...this.contracts]
        : this.contracts.filter(c =>
            String(c.id).includes(term) ||
            (c.ownerName || '').toLowerCase().includes(term) ||
            (c.tenantName || '').toLowerCase().includes(term) ||
            (c.rentalName || '').toLowerCase().includes(term)
        );
    }

    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    const list =
        this.activeTab === 'products'
        ? this.filteredProducts
        : this.activeTab === 'rentals'
        ? this.filteredRentals
        : this.activeTab === 'orders'
        ? this.filteredOrders
        : this.activeTab === 'reservations'
        ? this.filteredReservations
        : this.activeTab === 'paiement'
        ? this.filteredPaidOrders
        : this.activeTab === 'contracts'
        ? this.filteredContracts
        : [];

    this.totalPages = Math.max(1, Math.ceil(list.length / this.pageSize));

    if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;

    if (this.activeTab === 'products') {
        this.paginatedProducts = this.filteredProducts.slice(start, end);
    }

    if (this.activeTab === 'rentals') {
        this.paginatedRentals = this.filteredRentals.slice(start, end);
    }

    if (this.activeTab === 'orders') {
        this.paginatedOrders = this.filteredOrders.slice(start, end);
    }

    if (this.activeTab === 'reservations') {
        this.paginatedReservations = this.filteredReservations.slice(start, end);
    }

    if (this.activeTab === 'paiement') {
    this.paginatedPaidOrders = this.filteredPaidOrders.slice(start, end);
    }

    if (this.activeTab === 'contracts') {
        this.paginatedContracts = this.filteredContracts.slice(start, end);
    }
    }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  extractId(url: string): number {
    return Number(url.split('/').pop());
  }

  deleteProduct(product: any): void {
    const confirmed = confirm(`Delete product "${product.nom}" ?`);
    if (!confirmed) return;

    this.productService.delete(product.id).subscribe({
      next: () => {
        this.products = this.products.filter(p => p.id !== product.id);
        this.applyFilter();
      },
      error: (err) => {
        console.error('Delete failed', err);
        alert('Failed to delete product.');
      }
    });
  }

  deleteRental(rental: any): void {
    const confirmed = confirm(`Delete rental "${rental.nom}" ?`);
    if (!confirmed) return;

    this.locationService.delete(rental.id).subscribe({
      next: () => {
        this.rentals = this.rentals.filter(r => r.id !== rental.id);
        this.applyFilter();
      },
      error: (err) => {
        console.error('Delete rental failed', err);
        alert(err?.error?.message || 'Failed to delete rental.');
      }
    });
  }

  getOrderStatusLabel(status: string): string {
  switch (status) {
    case 'VALIDEE':
      return 'Validated';
    case 'ANNULEE':
      return 'Cancelled';
    case 'EN_COURS':
      return 'In Progress';
    default:
      return status;
  }
}

  async loadOrders(): Promise<void> {
  this.loading = true;

  this.adminOrderService.getAllOrders().subscribe({
    next: async (data: any) => {
      const commandes = Array.isArray(data) ? data : (data?.content || data?._embedded?.commandes || []);

      this.orders = commandes.map((c: any) => ({
        id: c.id,
        dateCommande: c.dateCommande,
        montantTotal: c.montantTotal,
        statut: c.statut,
        idUser: c.userId,
        panierId: c.panier_id || c.panierId,
        userName: 'Loading...'
      }));

      await this.attachUserNames(this.orders);
      this.applyFilter();
      this.loading = false;
    },
    error: (err) => {
      console.error('Error loading orders', err);
      this.loading = false;
    }
  });
}


    openOrderDetails(order: any): void {
  this.showOrderDetails = true;
  this.selectedOrder = {
    ...order,
    items: [],
    loadingDetails: true
  };

  this.adminOrderService.getOrderDetails(order.id).subscribe({
    next: (details: any) => {
      this.selectedOrder = {
        ...order,
        ...details,
        items: details?.items || [],
        loadingDetails: false
      };
    },
    error: (err) => {
      console.error('Failed to load order details', err);
      this.selectedOrder = {
        ...order,
        items: [],
        loadingDetails: false
      };
    }
  });
}

closeOrderDetails(): void {
  this.showOrderDetails = false;
  this.selectedOrder = null;
}

async loadReservations(): Promise<void> {
  this.loading = true;

  this.reservationVisiteService.getAll().subscribe({
    next: async (data: any) => {
      const reservations = Array.isArray(data)
        ? data
        : (data?.content || data?._embedded?.reservationVisites || []);

      this.reservations = reservations.map((r: any) => ({
        id: r.id,
        dateVisite: r.dateVisite,
        heureDebut: r.heureDebut,
        heureFin: r.heureFin,
        statut: r.statut,
        idUser: r.userId ?? r.idUser ?? r.clientId,
        locationId:
          r.location?.id ??
          r.locationId ??
          r.idLocation ??
          this.extractIdFromHref(r._links?.location?.href),
        userName: 'Loading...',
        rentalName: 'Loading...',
        rentalType: '',
        rentalLocation: ''
      }));

      await this.attachReservationExtraData();
      this.applyFilter();
      this.loading = false;
    },
    error: (err) => {
      console.error('Error loading reservations', err);
      this.loading = false;
    }
  });
}

async attachReservationExtraData(): Promise<void> {
  await this.attachUserNames(this.reservations);

  const uniqueLocationIds = [
    ...new Set(
      this.reservations
        .map(r => r.locationId)
        .filter(id => id !== null && id !== undefined)
    )
  ];

  const rentalMap = new Map<number, any>();

  await Promise.all(
    uniqueLocationIds.map(async (locationId) => {
      try {
        const rental = await firstValueFrom(this.locationService.getById(locationId));
        rentalMap.set(locationId, rental);
      } catch (e) {
        console.error('Failed to load rental', locationId, e);
      }
    })
  );

  this.reservations = this.reservations.map(r => {
    const rental = rentalMap.get(r.locationId);

    return {
      ...r,
      rentalName:
        rental?.nom ||
        (rental?.type === 'terrain' ? 'Land Rental' : 'Machine Rental') ||
        `Rental #${r.locationId}`,
      rentalType: rental?.type || '',
      rentalLocation: rental?.localisation || ''
    };
  });
}

extractIdFromHref(href?: string): number | null {
  if (!href) return null;
  const parts = href.split('/');
  const last = parts[parts.length - 1];
  return last ? Number(last) : null;
}

getReservationStatusLabel(status: string): string {
  switch (status) {
    case 'EN_ATTENTE':
      return 'Pending';
    case 'CONFIRMEE':
      return 'Confirmed';
    case 'REFUSEE':
      return 'Refused';
    case 'TERMINEE':
      return 'Completed';
    case 'ANNULEE':
      return 'Cancelled';
    default:
      return status;
  }
}

deleteReservation(reservation: any): void {
  const confirmed = confirm(
    `Delete reservation #${reservation.id} for ${reservation.userName}?`
  );

  if (!confirmed) return;

  this.reservationVisiteService.deleteReservation(reservation.id).subscribe({
    next: () => {
      this.reservations = this.reservations.filter(r => r.id !== reservation.id);
      this.applyFilter();
    },
    error: (err) => {
      console.error('Delete reservation failed', err);
      alert('Failed to delete reservation.');
    }
  });
}


async loadPaidOrders(): Promise<void> {
  this.loading = true;

  this.adminOrderService.getAllOrders().subscribe({
    next: async (data: any) => {
      const commandes = Array.isArray(data)
        ? data
        : (data?.content || data?._embedded?.commandes || []);

      const validatedOrders = commandes.filter((c: any) => c.statut === 'VALIDEE');

      const detailedOrders = await Promise.all(
        validatedOrders.map(async (c: any) => {
          let details: any = null;

          try {
            details = await firstValueFrom(this.adminOrderService.getOrderDetails(c.id));
          } catch (e) {
            console.error('Failed to load paid order details', c.id, e);
          }

          return {
            id: c.id,
            dateCommande: c.dateCommande,
            montantTotal: c.montantTotal,
            statut: c.statut,
            idUser: c.userId ?? c.idUser,
            panierId: c.panierId ?? c.panier_id,
            userName: 'Loading...',
            items: details?.items || []
          };
        })
      );

      this.paidOrders = detailedOrders;

      await this.attachUserNames(this.paidOrders);
      this.computePaymentStats();
      this.applyFilter();

      this.loading = false;
    },
    error: (err) => {
      console.error('Error loading paid orders', err);
      this.loading = false;
    }
  });
}

computePaymentStats(): void {
  const totalIncome = this.paidOrders.reduce(
    (sum, order) => sum + (Number(order.montantTotal) || 0),
    0
  );

  const productCounter = new Map<string, number>();
  let totalProductsSold = 0;

  this.paidOrders.forEach(order => {
    (order.items || []).forEach((item: any) => {
      const productName = item.nom || 'Unknown Product';
      const qty = Number(item.quantite) || 0;

      totalProductsSold += qty;
      productCounter.set(productName, (productCounter.get(productName) || 0) + qty);
    });
  });

  let mostBoughtProduct = '—';
  let maxQty = 0;

  productCounter.forEach((qty, name) => {
    if (qty > maxQty) {
      maxQty = qty;
      mostBoughtProduct = name;
    }
  });

  this.paymentStats = {
    totalIncome,
    paidOrdersCount: this.paidOrders.length,
    mostBoughtProduct,
    totalProductsSold
  };
}


isFinalizedContract(proposal: any): boolean {
  return !!proposal?.signatureAgriculteur && !!proposal?.signatureClient;
}

async loadContracts(): Promise<void> {
  this.loading = true;

  const currentUserId = Number(localStorage.getItem('adminUserId') || 1);

  this.reservationVisiteService.getProposalsByAgriculteur(currentUserId).subscribe({
    next: async (proposals: any[]) => {
      const finalized = (proposals || []).filter(p => this.isFinalizedContract(p));

      this.contracts = finalized.map((p: any) => ({
        id: p.id,
        agriculteurId: p.agriculteurId,
        locataireId: p.locataireId,
        locationId: p.locationId,
        dateDebut: p.dateDebut,
        dateFin: p.dateFin,
        nbMois: p.nbMois,
        montantMensuel: p.montantMensuel,
        montantTotal: p.montantTotal,
        statut: p.statut,
        signatureAgriculteur: p.signatureAgriculteur,
        signatureClient: p.signatureClient,
        ownerName: 'Loading...',
        tenantName: 'Loading...',
        rentalName: 'Loading...',
        rentalType: '',
        rentalLocation: ''
      }));

      await this.attachContractExtraData();
      this.applyFilter();
      this.loading = false;
    },
    error: (err) => {
      console.error('Error loading contracts', err);
      this.loading = false;
    }
  });
}

async attachContractExtraData(): Promise<void> {
  const ownerIds = [...new Set(this.contracts.map(c => c.agriculteurId).filter((id: any) => id != null))];
  const tenantIds = [...new Set(this.contracts.map(c => c.locataireId).filter((id: any) => id != null))];
  const locationIds = [...new Set(this.contracts.map(c => c.locationId).filter((id: any) => id != null))];

  const userMap = new Map<number, string>();
  const rentalMap = new Map<number, any>();

  await Promise.all([
    ...ownerIds.map(async (id) => {
      try {
        const user = await firstValueFrom(this.adminUserService.getUserById(id));
        userMap.set(id, `${user?.prenom || ''} ${user?.nom || ''}`.trim() || user?.username || user?.email || `User #${id}`);
      } catch {
        userMap.set(id, `User #${id}`);
      }
    }),
    ...tenantIds.map(async (id) => {
      try {
        const user = await firstValueFrom(this.adminUserService.getUserById(id));
        userMap.set(id, `${user?.prenom || ''} ${user?.nom || ''}`.trim() || user?.username || user?.email || `User #${id}`);
      } catch {
        userMap.set(id, `User #${id}`);
      }
    }),
    ...locationIds.map(async (id) => {
      try {
        const rental = await firstValueFrom(this.locationService.getById(id));
        rentalMap.set(id, rental);
      } catch {
        rentalMap.set(id, null);
      }
    })
  ]);

  this.contracts = this.contracts.map(c => {
    const rental = rentalMap.get(c.locationId);

    return {
      ...c,
      ownerName: userMap.get(c.agriculteurId) || `User #${c.agriculteurId}`,
      tenantName: userMap.get(c.locataireId) || `User #${c.locataireId}`,
      rentalName: rental?.nom || (rental?.type === 'terrain' ? 'Land Rental' : 'Machine Rental') || `Rental #${c.locationId}`,
      rentalType: rental?.type || '',
      rentalLocation: rental?.localisation || ''
    };
  });
}

getContractStatusLabel(status: string): string {
  switch (status) {
    case 'SIGNEE':
      return 'Signed';
    case 'ACCEPTEE':
      return 'Accepted';
    case 'FINALISEE':
      return 'Finalized';
    default:
      return 'Finalized Contract';
  }
}

viewContract(contract: any): void {
  this.router.navigate(
    ['/marketplace/rental-contract', contract.id],
    { queryParams: { from: 'admin' } }
  );
}
}
