import { of } from 'rxjs';
import { DeliveryActiveComponent } from './delivery-active.component';
import { DeliveryRequest } from '../../services/delivery-request.service';

describe('DeliveryActiveComponent Simulation', () => {
  const sampleRequest: DeliveryRequest = {
    id: '36',
    reference: 'DLV-MNFUIUR2',
    product: 'Tomates',
    weightKg: 1000,
    details: '',
    pickupLabel: 'Kasserine',
    dropoffLabel: 'Tunis',
    estimatedPrice: 257.64,
    pickupLat: 35.1687646,
    pickupLng: 8.8365654,
    dropoffLat: 36.8065,
    dropoffLng: 10.1815,
    autoGrouping: true,
    status: 'En cours',
    createdByRole: 'Agriculteur',
    createdByEmail: 'farmer-3136@local',
    createdById: 3136,
    acceptedById: 1422,
    acceptedByEmail: 'transporter-1422@local',
    createdAt: new Date().toISOString(),
    currentLat: 35.1687646,
    currentLng: 8.8365654
  };

  function createComponent(startRouteSuccess = true): DeliveryActiveComponent {
    const requestServiceMock = {
      refreshFromBackend: jasmine.createSpy('refreshFromBackend').and.returnValue(of([])),
      getTransporterActiveRequests: jasmine.createSpy('getTransporterActiveRequests').and.returnValue([sampleRequest]),
      startRouteToPickup: jasmine.createSpy('startRouteToPickup').and.returnValue(of({
        success: startRouteSuccess,
        delivery: startRouteSuccess ? {} : null,
        errorMessage: startRouteSuccess ? undefined : 'Start route indisponible'
      })),
      updateStatus: jasmine.createSpy('updateStatus'),
      getById: jasmine.createSpy('getById').and.returnValue(sampleRequest)
    };

    const routerMock = {
      navigate: jasmine.createSpy('navigate')
    };

    return new DeliveryActiveComponent(requestServiceMock as any, routerMock as any);
  }

  it('loads active requests on init', () => {
    const component = createComponent();
    component.ngOnInit();
    expect(component.activeRequests.length).toBe(1);
    expect(component.activeRequests[0].id).toBe('36');
  });

  it('starts pickup route and redirects to transporter route workflow', () => {
    const component = createComponent(true);

    component.openRouteWorkflow({ ...sampleRequest, status: 'Acceptée' });

    const router = (component as any).router;
    const requestService = (component as any).requestService;
    expect(requestService.startRouteToPickup).toHaveBeenCalledWith(sampleRequest.id);
    expect(router.navigate).toHaveBeenCalledWith(['/delivery/active', sampleRequest.id, 'route']);
  });

  it('shows backend error when start route fails', () => {
    const component = createComponent(false);

    component.openRouteWorkflow({ ...sampleRequest, status: 'Acceptée' });

    expect(component.notification).toContain('Start route indisponible');
  });

  it('opens route workflow directly for deliveries already in progress', () => {
    const component = createComponent();
    component.openRouteWorkflow(sampleRequest);

    const router = (component as any).router;
    const requestService = (component as any).requestService;
    expect(requestService.startRouteToPickup).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/delivery/active', sampleRequest.id, 'route']);
  });
});



