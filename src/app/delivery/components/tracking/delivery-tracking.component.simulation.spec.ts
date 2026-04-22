import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { DeliveryTrackingComponent } from './delivery-tracking.component';

describe('DeliveryTrackingComponent Simulation', () => {
  function createComponent(): DeliveryTrackingComponent {
    const requestServiceMock = {
      getCurrentUserId: jasmine.createSpy('getCurrentUserId').and.returnValue(3136),
      getAll: jasmine.createSpy('getAll').and.returnValue([
        {
          id: '77',
          reference: 'DLV-SIM-77',
          product: 'Pommes',
          pickupLabel: 'Sidi Bouzid',
          dropoffLabel: 'Tunis',
          pickupLat: 34.74,
          pickupLng: 9.79,
          dropoffLat: 36.81,
          dropoffLng: 10.18,
          status: 'En cours',
          createdById: 3136,
          currentLat: 35.1,
          currentLng: 10.0
        }
      ]),
      refreshFromBackend: jasmine.createSpy('refreshFromBackend').and.returnValue(of([])),
      updateCurrentPosition: jasmine.createSpy('updateCurrentPosition').and.returnValue(of(null)),
      deleteApiDelivery: jasmine.createSpy('deleteApiDelivery').and.returnValue(of(true))
    };

    const mapServiceMock = {
      clear: jasmine.createSpy('clear'),
      addMarker: jasmine.createSpy('addMarker'),
      addCircleMarker: jasmine.createSpy('addCircleMarker'),
      drawRouteOSRM: jasmine.createSpy('drawRouteOSRM').and.returnValue(Promise.resolve(null)),
      fitBounds: jasmine.createSpy('fitBounds'),
      getRouteGuidance: jasmine.createSpy('getRouteGuidance').and.returnValue(Promise.resolve({ etaMinutes: 12 })),
      getPointIcon: jasmine.createSpy('getPointIcon').and.returnValue({} as any),
      getMap: jasmine.createSpy('getMap').and.returnValue(null),
      initMap: jasmine.createSpy('initMap'),
      destroy: jasmine.createSpy('destroy')
    };

    const routerMock = {
      navigate: jasmine.createSpy('navigate')
    };

    const routeMock = {
      queryParamMap: of({ get: () => null })
    };

    return new DeliveryTrackingComponent(mapServiceMock as any, requestServiceMock as any, routerMock as any, routeMock as any);
  }

  it('loads farmer deliveries and keeps selected id', () => {
    const component = createComponent();
    component.ngOnInit();

    expect(component.deliveries.length).toBe(1);
    expect(component.selectedDelivery?.reference).toBe('DLV-SIM-77');
  });

  it('starts simulation when selected delivery is in progress', () => {
    const component = createComponent();
    component.ngOnInit();

    component.launchTrackingSimulation();

    expect(component.simulationRunning).toBeTrue();
    component.stopSimulation();
  });

  it('updates progress and sends GPS updates during simulation', fakeAsync(() => {
    const component = createComponent();
    component.ngOnInit();

    component.launchTrackingSimulation();
    tick(1300);

    expect(component.simulationProgress).toBeGreaterThan(0);
    expect(component.simulationRunning).toBeTrue();

    const requestService = (component as any).requestService;
    expect(requestService.updateCurrentPosition).toHaveBeenCalled();
    component.stopSimulation();
  }));
});

