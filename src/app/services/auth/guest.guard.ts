import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.authService.hasActiveSession()) {
      const redirectRoute = this.authService.getDefaultRouteForRole(this.authService.getCurrentRole());
      this.router.navigate([redirectRoute]);
      return false;
    }

    return true;
  }
}
