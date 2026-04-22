import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService, BackendRole } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    if (!this.authService.hasActiveSession()) {
      this.router.navigate(['/auth'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/auth'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const requiredRoles = route.data['roles'] as BackendRole[] | undefined;
    if (requiredRoles && !this.authService.hasAnyRole(...requiredRoles)) {
      const fallbackRoute = this.authService.getDefaultRouteForRole(user.role);
      this.router.navigate([fallbackRoute]);
      return false;
    }

    return true;
  }
}
