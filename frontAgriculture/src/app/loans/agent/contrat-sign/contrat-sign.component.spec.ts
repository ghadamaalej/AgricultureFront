import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContratSignComponent } from './contrat-sign.component';

describe('ContratSignComponent', () => {
  let component: ContratSignComponent;
  let fixture: ComponentFixture<ContratSignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContratSignComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ContratSignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
