import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterExtraComponent } from './register-extra.component';

describe('RegisterExtraComponent', () => {
  let component: RegisterExtraComponent;
  let fixture: ComponentFixture<RegisterExtraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterExtraComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RegisterExtraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
