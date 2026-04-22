import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgriDashboardComponent } from './agri-dashboard.component';

describe('AgriDashboardComponent', () => {
  let component: AgriDashboardComponent;
  let fixture: ComponentFixture<AgriDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgriDashboardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AgriDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
