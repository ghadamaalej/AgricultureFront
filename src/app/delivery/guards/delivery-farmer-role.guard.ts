import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { getDeliveryUserRole } from '../services/delivery-auth.helper';

@Injectable({
  providedIn: 'root'
})
export class DeliveryFarmerRoleGuard implements CanActivate {
  constructor(private readonly router: Router) {}

  canActivate(): boolean | UrlTree {
    const role = getDeliveryUserRole();
    const isFarmer = role === 'agriculteur' || role === 'farmer' || role.includes('agric');

    if (isFarmer) {
      return true;
    }

    return this.router.createUrlTree(['/delivery/home']);
  }
}

