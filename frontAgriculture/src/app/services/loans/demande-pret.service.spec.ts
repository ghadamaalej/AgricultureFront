import { TestBed } from '@angular/core/testing';

import { DemandePretService } from './demande-pret.service';

describe('DemandePretService', () => {
  let service: DemandePretService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DemandePretService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
