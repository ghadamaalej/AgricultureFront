import { of } from 'rxjs';
import {
  DeliveryAdminKpis,
  DeliveryRequest,
  DeliveryRequestService
} from '../../services/delivery-request.service';
import { DeliveryAdminOverviewComponent } from './delivery-admin-overview.component';

describe('DeliveryAdminOverviewComponent', () => {
  const now = Date.now();
  const recentDate = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
  const oldDate = new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString();

  const requests: DeliveryRequest[] = [
    {
      id: '1',
      reference: 'DLV-001',
      product: 'Tomates',
      weightKg: 200,
      details: '',
      pickupLabel: 'Sousse',
      dropoffLabel: 'Tunis',
      estimatedPrice: 100,
      pickupLat: 35.82,
      pickupLng: 10.63,
      dropoffLat: 36.8,
      dropoffLng: 10.17,
      autoGrouping: false,
      status: 'Livrée',
      createdByRole: 'Agriculteur',
      createdByEmail: 'farmer1@test.tn',
      createdById: 10,
      acceptedByEmail: 'transporter1@test.tn',
      acceptedById: 30,
      createdAt: recentDate,
      deliveredAt: recentDate
    },
    {
      id: '2',
      reference: 'DLV-002',
      product: 'Pommes de terre',
      weightKg: 320,
      details: '',
      pickupLabel: 'Kairouan',
      dropoffLabel: 'Ariana',
      estimatedPrice: 180,
      pickupLat: 35.67,
      pickupLng: 10.1,
      dropoffLat: 36.86,
      dropoffLng: 10.19,
      autoGrouping: true,
      status: 'En cours',
      createdByRole: 'Agriculteur',
      createdByEmail: 'farmer2@test.tn',
      createdById: 11,
      acceptedByEmail: 'transporter2@test.tn',
      acceptedById: 31,
      createdAt: oldDate
    }
  ];

  const kpis: DeliveryAdminKpis = {
    total: 2,
    enAttente: 0,
    acceptees: 0,
    enCours: 1,
    livre: 1,
    annulees: 0,
    revenue: 100,
    avgPrice: 140,
    tauxLivraison: 50
  };

  function createComponent(customRequests: DeliveryRequest[] = requests, customKpis: DeliveryAdminKpis = kpis): DeliveryAdminOverviewComponent {
    const serviceMock = {
      refreshFromBackend: jasmine.createSpy('refreshFromBackend').and.returnValue(of(customRequests)),
      getAdminKpis: jasmine.createSpy('getAdminKpis').and.returnValue(of(customKpis))
    } as unknown as DeliveryRequestService;

    return new DeliveryAdminOverviewComponent(serviceMock);
  }

  it('loads complete admin statistics and ranking data', () => {
    const component = createComponent();

    component.ngOnInit();

    expect(component.stats.total).toBe(2);
    expect(component.stats.deliveryRate).toBe(50);
    expect(component.statusBreakdown.length).toBe(5);
    expect(component.monthlyTrend.length).toBe(6);
    expect(component.topTransporters.length).toBe(2);
    expect(component.topProducts.length).toBe(2);
  });

  it('filters displayed rows by status, period and search term', () => {
    const component = createComponent();

    component.ngOnInit();
    component.statusFilter = 'Livrée';
    expect(component.displayedRows.length).toBe(1);

    component.statusFilter = 'ALL';
    component.periodFilter = '30D';
    expect(component.displayedRows.length).toBe(1);

    component.periodFilter = 'ALL';
    component.searchTerm = 'pommes';
    expect(component.displayedRows.length).toBe(1);
    expect(component.displayedRows[0].reference).toBe('DLV-002');
  });
});

