import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { getDeliveryUserRole } from '../services/delivery-auth.helper';

@Injectable({
  providedIn: 'root'
})
export class DeliveryAdminRoleGuard implements CanActivate {
  constructor(private readonly router: Router) {}

  canActivate(): boolean {
    const role = getDeliveryUserRole();
    const isAdmin = role.includes('admin');

    if (isAdmin) {
      return true;
    }

    this.router.navigate(['/delivery']);
    return false;
  }
}
