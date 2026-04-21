import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { getDeliveryUserRole, getDeliveryUserId } from '../../services/delivery-auth.helper';

type DeliveryMenuKey =
  | 'home'
  | 'create'
  | 'createPreferred'
  | 'tracking'
  | 'active'
  | 'calendar'
  | 'stats'
  | 'history'
  | 'demandes'
  | 'dashboard'
  | 'groups'
  | 'admin'
  | 'livraisons';

@Component({
  selector: 'app-delivery-layout',
  standalone: false,
  templateUrl: './delivery-layout.component.html',
  styleUrls: ['./delivery-layout.component.css']
})
export class DeliveryLayoutComponent implements OnInit {
  sidebarOpen = true;
  activeKey: DeliveryMenuKey = 'home';
  currentUserId = 0;

  role = getDeliveryUserRole();
  isFarmer = this.isFarmerRole(this.role);
  isTransporter = this.isTransporterRole(this.role);
  isAdmin = this.isAdminRole(this.role);

  private allMenuItems: Array<{
    key: DeliveryMenuKey;
    label: string;
    route: string;
    icon: string;
  }> = [
    { key: 'home', label: 'Accueil', route: '/delivery', icon: 'fas fa-home' },
    { key: 'create', label: 'Créer', route: '/delivery/create', icon: 'fas fa-map-marker-alt' },
    { key: 'createPreferred', label: 'Livreur préféré', route: '/delivery/create-with-transporter', icon: 'fas fa-user-check' },
    { key: 'tracking', label: 'Suivi', route: '/delivery/tracking', icon: 'fas fa-route' },
    { key: 'history', label: 'Historique', route: '/delivery/history', icon: 'fas fa-clock-rotate-left' },
    { key: 'demandes', label: 'Demandes', route: '/delivery/demandes', icon: 'fas fa-handshake' },
    { key: 'dashboard', label: 'Statistiques', route: '/delivery/dashboard', icon: 'fas fa-chart-line' },
    { key: 'groups', label: 'Groupes', route: '/delivery/groups', icon: 'fas fa-layer-group' },
    { key: 'admin', label: 'Admin global', route: '/delivery/admin', icon: 'fas fa-user-shield' }
  ];

  menuItems: Array<{
    key: DeliveryMenuKey;
    label: string;
    route: string;
    icon: string;
  }> = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (this.isTransporter) {
      this.menuItems = [
        { key: 'home', label: 'Demandes', route: '/delivery', icon: 'fas fa-inbox' },
        { key: 'active', label: 'En cours', route: '/delivery/active', icon: 'fas fa-truck-fast' },
        { key: 'calendar', label: 'Calendrier', route: '/delivery/calendar', icon: 'fas fa-calendar-days' },
        { key: 'stats', label: 'Statistiques', route: '/delivery/stats', icon: 'fas fa-chart-line' },
        { key: 'history', label: 'Historique', route: '/delivery/history', icon: 'fas fa-clock-rotate-left' },
        { key: 'groups', label: 'Groupes', route: '/delivery/groups', icon: 'fas fa-layer-group' }
      ];
    } else if (this.isAdmin) {
      this.menuItems = this.allMenuItems;
    } else if (this.isFarmer) {
      this.menuItems = this.allMenuItems.filter((item) => item.key !== 'demandes' && item.key !== 'admin');
    } else {
      this.menuItems = this.allMenuItems.filter((item) => item.key !== 'admin');
    }

    this.currentUserId = this.resolveCurrentUserId();

    this.syncActiveKey(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.syncActiveKey(e.urlAfterRedirects));
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  onMenuItemClick(route: string): void {
    this.router.navigateByUrl(route);
    this.sidebarOpen = true;
  }

  onNotificationDeliverySelected(deliveryId: number): void {
    this.router.navigate(['/delivery/tracking'], {
      queryParams: { deliveryId }
    });
  }

  private syncActiveKey(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const sortedBySpecificity = [...this.menuItems].sort((a, b) => b.route.length - a.route.length);
    const match = sortedBySpecificity.find((m) => cleanUrl === m.route || cleanUrl.startsWith(m.route + '/'));
    this.activeKey = (match?.key ?? 'home') as DeliveryMenuKey;
  }

  private isFarmerRole(role: string): boolean {
    const normalized = role.trim().toLowerCase();
    return normalized === 'agriculteur' || normalized === 'farmer' || normalized.includes('agric');
  }

  private isTransporterRole(role: string): boolean {
    const normalized = role.trim().toLowerCase();
    return normalized === 'transporter' || normalized === 'transporteur' || normalized.includes('transport');
  }

  private isAdminRole(role: string): boolean {
    return role.trim().toLowerCase().includes('admin');
  }

  private resolveCurrentUserId(): number {
    return getDeliveryUserId() ?? 0;
  }

  get activeLabel(): string {
    return this.menuItems.find((item) => item.key === this.activeKey)?.label ?? 'Accueil';
  }
}
