import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth/auth.service';

interface NavDropdownLink {
  label: string;
  icon: string;
  route: string;
  hasSubmenu?: boolean;
  submenu?: Array<{ label: string; icon: string; route: string }>;
}

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {

  @Output() onAuthOpen = new EventEmitter<'signin' | 'signup'>();

  private destroy$ = new Subject<void>();

  isScrolled       = false;
  isMobileMenuOpen = false;
  isLoggedIn       = false;
  isHomePage       = true;
  activeLink       = '/';
  moreDropdownOpen = false;
  activeSubmenu: any[] | null = null;

  navLinks = [
    { label: 'Home',        route: '/'                     },
    { label: 'Marketplace', route: '/marketplace'          },
    { label: 'Forum',       route: '/forums'               },
    { label: 'Loans',       route: '/loans'                },
    { label: 'Delivery',    route: '/delivery'             },
    { label: 'Events',      route: '/events/listEvents'    },
    { label: 'Trainings',   route: '/formations'           },
  ];

  dropdownLinks: NavDropdownLink[] = [
    { label: 'Terrain',       icon: 'fas fa-leaf',            route: '/farm',         hasSubmenu: true, submenu: [
        { label: 'Add Terrain',  icon: 'fas fa-plus',           route: '/farm/add'      },
        { label: 'My Terrains',  icon: 'fas fa-list',           route: '/farm/list'     }
      ]},
    { label: 'Inventory',         icon: 'fas fa-boxes',          route: '/inventory'    },
    { label: 'Appointments',      icon: 'fas fa-calendar-check', route: '/appointments' },
    { label: 'Animals',           icon: 'fas fa-paw',            route: '/animals'      },
    { label: 'Disease Predictor', icon: 'fas fa-microscope',     route: '/disease-predictor' },
    { label: 'Help Request',      icon: 'fas fa-hands-helping',  route: '/help-request' },
  ];

  constructor(
      private router: Router,
      private authService: AuthService
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.hasActiveSession();
    this.syncExpertLink();
    this.isHomePage = this.router.url === '/';
    this.activeLink = this.router.url;

    this.router.events
        .pipe(
            filter(e => e instanceof NavigationEnd),
            takeUntil(this.destroy$)
        )
        .subscribe((e: any) => {
          this.isLoggedIn       = this.authService.hasActiveSession();
          this.isHomePage       = e.urlAfterRedirects === '/';
          this.activeLink       = e.urlAfterRedirects;
          this.moreDropdownOpen = false;
          this.isMobileMenuOpen = false;
          this.syncExpertLink();
        });
  }

  @HostListener('window:scroll', [])
  onScroll() { this.isScrolled = window.scrollY > 80; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-wrap')) {
      this.moreDropdownOpen = false;
    }
  }

  navigate(route: string) {
    this.router.navigate([route]);
    this.isMobileMenuOpen = false;
    this.moreDropdownOpen = false;
  }

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.moreDropdownOpen = !this.moreDropdownOpen;
  }

  showSubmenu(dropdownItem: any) {
    if (dropdownItem.hasSubmenu) {
      this.activeSubmenu = dropdownItem.submenu;
    }
  }

  hideSubmenu() {
    this.activeSubmenu = null;
  }

  isDropdownActive(): boolean {
    return this.dropdownLinks.some((l) => this.isDropdownLinkActive(l));
  }

  isDropdownLinkActive(link: NavDropdownLink): boolean {
    if (this.activeLink === link.route) {
      return true;
    }
    if (link.hasSubmenu) {
      return this.activeLink.startsWith(`${link.route}/`);
    }
    return false;
  }

  toggleMobile() { this.isMobileMenuOpen = !this.isMobileMenuOpen; }

  signIn() {
    localStorage.setItem('authMode', 'signin');
    if (this.onAuthOpen.observers.length > 0) {
      this.onAuthOpen.emit('signin');
      return;
    }
    this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
  }

  signUp() {
    localStorage.setItem('authMode', 'signup');
    if (this.onAuthOpen.observers.length > 0) {
      this.onAuthOpen.emit('signup');
      return;
    }
    this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
  }

  logout() {
    this.authService.logout();
    this.isLoggedIn = false;
    this.router.navigate(['/']);
  }

  private syncExpertLink(): void {
    const isExpert = this.authService.hasRole('EXPERT_AGRICOLE');
    const route = '/expert/assistance-requests';
    const hasLink = this.dropdownLinks.some((link) => link.route === route);

    if (isExpert && !hasLink) {
      this.dropdownLinks = [
        ...this.dropdownLinks,
        { label: 'Expert Requests', icon: 'fas fa-clipboard-list', route, hasSubmenu: false }
      ];
    }

    if (!isExpert && hasLink) {
      this.dropdownLinks = this.dropdownLinks.filter((link) => link.route !== route);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}