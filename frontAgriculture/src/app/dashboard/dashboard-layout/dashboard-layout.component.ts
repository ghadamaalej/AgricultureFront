import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: false,
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.css']
})
export class DashboardLayoutComponent implements OnInit {

  sidebarOpen = true;
  activeMenu  = 'dashboard';

  menuItems = [
    { icon: 'fas fa-th-large',           label: 'Dashboard',    key: 'dashboard',    route: '/dashboard'              },
    { icon: 'fas fa-users',              label: 'Users',        key: 'users',        route: '/dashboard/users'        },
    { icon: 'fas fa-truck',              label: 'Deliveries',   key: 'deliveries',   route: '/dashboard/deliveries'   },
    { icon: 'fas fa-calendar-alt',       label: 'Events',       key: 'events',       route: '/dashboard/events'       },
    { icon: 'fas fa-hand-holding-usd',   label: 'Loans',        key: 'loans',        route: '/dashboard/loans'        },
    { icon: 'fas fa-store',              label: 'Marketplace',  key: 'marketplace',  route: '/dashboard/marketplace'  },
    { icon: 'fas fa-comments',           label: 'Community',    key: 'community',    route: '/dashboard/forums'       },
    { icon: 'fas fa-graduation-cap',     label: 'Training',     key: 'training',     route: '/dashboard/training'     },
    { icon: 'fas fa-exclamation-circle', label: 'Claims',       key: 'claims',       route: '/dashboard/claims'       },
    { icon: 'fas fa-stethoscope',        label: 'Appointments', key: 'appointments', route: '/dashboard/appointments' },
    { icon: 'fas fa-hands-helping',         label: 'Helps',    key: 'Helps',    route: '/dashboard/Aide'    },
    { icon: 'fas fa-paw',                label: 'Animals',     key: 'Animals',     route: '/dashboard/Animals'     },
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Sync activeMenu with current URL on load and navigation
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const url = e.urlAfterRedirects;
        const matched = this.menuItems.find(item => url === item.route || url.startsWith(item.route + '/'));
        if (matched) this.activeMenu = matched.key;
      });

    // Set on first load
    const current = this.router.url;
    const matched = this.menuItems.find(item => current === item.route || current.startsWith(item.route + '/'));
    if (matched) this.activeMenu = matched.key;
  }

  setActive(key: string, route: string): void {
    this.activeMenu = key;
    this.router.navigate([route]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  goHome(): void        { this.router.navigate(['/']); }
}