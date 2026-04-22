import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardEventComponent } from './dashboard-event.component';

describe('DashboardEventComponent', () => {
  let component: DashboardEventComponent;
  let fixture: ComponentFixture<DashboardEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardEventComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DashboardEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
