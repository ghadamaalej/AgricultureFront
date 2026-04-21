import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class InventoryAuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (!this.auth.hasActiveSession()) {
      // Sauvegarder la destination pour rediriger après login
      localStorage.setItem('authMode', 'signin');
      localStorage.setItem('postLoginRoute', '/inventory');
      this.router.navigate(['/auth']);
      return false;
    }

    // Seuls les AGRICULTEUR peuvent accéder à l'inventaire
    const role = this.auth.getCurrentRole();
    if (role !== 'AGRICULTEUR') {
      this.router.navigate(['/']);
      return false;
    }

    return true;
  }
}
