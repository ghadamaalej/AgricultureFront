import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganisateurEventFormComponent } from './organisateur-event-form.component';

describe('OrganisateurEventFormComponent', () => {
  let component: OrganisateurEventFormComponent;
  let fixture: ComponentFixture<OrganisateurEventFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganisateurEventFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(OrganisateurEventFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
