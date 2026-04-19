import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-claims-layout',
  standalone: false,
  templateUrl: './claims-layout.component.html',
  styleUrls: ['./claims-layout.component.css']
})
export class ClaimsLayoutComponent implements OnInit {

  user: any = null;

  navItems = [
    { label: 'Mes Réclamations', icon: 'fas fa-list-alt', route: '/claims/my-claims' },
    { label: 'Nouvelle Réclamation', icon: 'fas fa-plus-circle', route: '/claims/new' },
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    if (!this.user) {
      this.router.navigate(['/claims/auth']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/claims/auth']);
  }

  goTo(route: string): void {
    this.router.navigate([route]);
  }

  isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }
}
