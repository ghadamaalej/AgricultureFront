import { TestBed } from '@angular/core/testing';

import { ServicePretService } from './service-pret.service';

describe('ServicePretService', () => {
  let service: ServicePretService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicePretService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
