import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-inventory-layout',
  standalone: false,
  templateUrl: './inventory-layout.component.html',
  styleUrls: ['./inventory-layout.component.css']
})
export class InventoryLayoutComponent {
  activeTab: 'inventory' | 'animals' | 'statistics' | 'boutique' = 'inventory';

  constructor(private auth: AuthService, private router: Router) {}

  get user() { return this.auth.getCurrentUser(); }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }

 setTab(tab: 'inventory' | 'animals' | 'statistics' | 'boutique') {
    this.activeTab = tab;
  }
}
