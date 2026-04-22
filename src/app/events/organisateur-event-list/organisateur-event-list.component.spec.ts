import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganisateurEventListComponent } from './organisateur-event-list.component';

describe('OrganisateurEventListComponent', () => {
  let component: OrganisateurEventListComponent;
  let fixture: ComponentFixture<OrganisateurEventListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganisateurEventListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(OrganisateurEventListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
