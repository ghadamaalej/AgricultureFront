import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators ,AbstractControl, ValidationErrors} from '@angular/forms';
import { AuthService, BackendRole } from '../../services/auth/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: false,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit {

  mode: 'signin' | 'signup' = 'signin';
  showSignInPass = false;
  showSignUpPass = false;
  previewUrl: string | null = null;
  loginError: string | null = null;
  isLoading = false;

  signInForm!:  FormGroup;
  signUpForm!:  FormGroup;

  // Roles that require extra info
  rolesWithExtra = [
    'Farmer', 'Transporter', 'AgriculturalExpert',
    'Agent', 'Veterinarian', 'EventOrganizer'
  ];

  get selectedRole(): string {
    return this.signUpForm?.get('role')?.value || '';
  }

  get needsExtraStep(): boolean {
    return this.rolesWithExtra.includes(this.selectedRole);
  }

  get submitLabel(): string {
    return this.needsExtraStep ? 'Next' : 'Create Account';
  }

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const savedMode = localStorage.getItem('authMode');
    if (savedMode === 'signin' || savedMode === 'signup') {
      this.mode = savedMode;
    }

    const rememberedEmail = localStorage.getItem('rememberedEmail');

    this.signInForm = new FormGroup({
      email:    new FormControl(rememberedEmail || '', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required, Validators.minLength(8)]),
      remember: new FormControl(rememberedEmail !== null)
    });

    this.signUpForm = new FormGroup({
      firstName: new FormControl('', [Validators.required,Validators.pattern(/^[a-zA-Z]+$/)]),
      lastName: new FormControl('', [Validators.required,Validators.pattern(/^[a-zA-Z]+$/)]),
      email:     new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl('', [ Validators.required,Validators.pattern(/^[0-9]{8}$/)]),
      password:  new FormControl('', [Validators.required, Validators.minLength(8)]),
      photo: new FormControl(null, [ Validators.required,this.imageValidator]),
      role: new FormControl('', Validators.required)
    });

    if (this.authService.hasActiveSession()) {
      const redirectRoute = this.authService.getDefaultRouteForRole(this.authService.getCurrentRole());
      this.router.navigate([redirectRoute]);
    }
  }

  switchTo(m: 'signin' | 'signup'): void {
    this.mode = m;
    localStorage.setItem('authMode', m);
  }

  togglePass(field: 'signin' | 'signup') {
    if (field === 'signin') this.showSignInPass = !this.showSignInPass;
    else                    this.showSignUpPass = !this.showSignUpPass;
  }

  siInvalid(field: string): boolean {
    if (!this.signInForm) {
      return false;
    }
    const c = this.signInForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  suInvalid(field: string): boolean {
    if (!this.signUpForm) {
      return false;
    }
    const c = this.signUpForm.get(field);
    return !!(c && c.invalid && c.touched);
  }

  submitSignIn(): void {
    if (this.signInForm.invalid) { this.signInForm.markAllAsTouched(); return; }

    this.isLoading = true;
    this.loginError = null;

    const { email, remember, password } = this.signInForm.value;

    this.authService.login(email, password).subscribe({
      next: (response) => {
        if (response.token) {
          if (remember) {
            localStorage.setItem('rememberedEmail', email);  
          } else {
            localStorage.removeItem('rememberedEmail');      
          }
          const redirectRoute = this.authService.getDefaultRouteForRole(
            response.role ? response.role as BackendRole : null
          );
          this.router.navigate([redirectRoute]);
        } else {
          this.loginError = response.message || 'Login failed';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.loginError = err.error?.message || 'An error occurred during login';
        this.isLoading = false;
      }
    });
  }

  submitSignUp(): void {
    if (this.signUpForm.invalid) { this.signUpForm.markAllAsTouched(); return; }

    if (this.needsExtraStep) {
      // Save base form data and navigate to extra info page
      localStorage.setItem('signupBase', JSON.stringify({
        ...this.signUpForm.value,
        photo: null // don't serialize File object
      }));
      localStorage.setItem('signupRole', this.selectedRole);
      this.router.navigate(['/register-extra']);
    } else {
      // Admin or Buyer — submit directly
      console.log('Sign Up (no extra):', this.signUpForm.value);
    }
  }

  imageValidator = (control: AbstractControl): ValidationErrors | null => {
    const file = control.value;
    if (!file) return null;
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) return { invalidType: true };
    if (file.size > 2 * 1024 * 1024) return { maxSize: true };
    return null;
  };

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.signUpForm.get('photo')?.setValue(file);
    this.signUpForm.get('photo')?.markAsTouched();
    const reader = new FileReader();
    reader.onload = () => this.previewUrl = reader.result as string;
    reader.readAsDataURL(file);
  }
}