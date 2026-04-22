import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DemandePretFormComponent } from './demande-pret-form.component';

describe('DemandePretFormComponent', () => {
  let component: DemandePretFormComponent;
  let fixture: ComponentFixture<DemandePretFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemandePretFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DemandePretFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
