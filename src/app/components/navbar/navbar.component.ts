import { Component, HostListener, OnInit, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {

  @Output() onAuthOpen = new EventEmitter<'signin' | 'signup'>();

  isScrolled       = false;
  isMobileMenuOpen = false;
  isLoggedIn       = false;
  isHomePage       = true;
  activeLink       = '/';
  moreDropdownOpen = false;
  activeSubmenu: any[] | null = null;

  navLinks = [
    { label: 'Home',        route: '/'            },
    { label: 'Marketplace', route: '/marketplace' },
    { label: 'Forum',       route: '/forum'       },
    { label: 'Loans',       route: '/loans'       },
    { label: 'Delivery',    route: '/delivery'    },
    { label: 'Events',      route: '/events'      },
    { label: 'Trainings',   route: '/training'    },
  ];

  dropdownLinks = [
    { label: 'Terrain',       icon: 'fas fa-leaf',            route: '/farm',         hasSubmenu: true, submenu: [
      { label: 'Add Terrain',  icon: 'fas fa-plus',           route: '/farm/add'      },
      { label: 'My Terrains',  icon: 'fas fa-list',           route: '/farm/list'     }
    ]},
    { label: 'Inventory',    icon: 'fas fa-boxes',          route: '/inventory'    },
    { label: 'Appointments', icon: 'fas fa-calendar-check', route: '/farm/calendar' },
    { label: 'Animals',      icon: 'fas fa-paw',            route: '/animals'      },
    { label: 'Disease Predictor', icon: 'fas fa-microscope', route: '/disease-predictor' },
    { label: 'Help Request', icon: 'fas fa-hands-helping',  route: '/help-request' },
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    this.isLoggedIn = !!localStorage.getItem('token');
    this.isHomePage = this.router.url === '/';
    this.activeLink = this.router.url;

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.isHomePage       = e.urlAfterRedirects === '/';
        this.activeLink       = e.urlAfterRedirects;
        this.moreDropdownOpen = false;
        this.isMobileMenuOpen = false;
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

  /** Highlights More items when on that route or (for Terrain) any /farm/* path */
  isDropdownLinkActive(link: { route: string; hasSubmenu?: boolean }): boolean {
    if (this.activeLink === link.route) {
      return true;
    }
    if (link.hasSubmenu) {
      return this.activeLink.startsWith(`${link.route}/`);
    }
    return false;
  }

  toggleMobile() { this.isMobileMenuOpen = !this.isMobileMenuOpen; }

  signIn()  { localStorage.setItem('authMode', 'signin');  this.onAuthOpen.emit('signin');  }
  signUp()  { localStorage.setItem('authMode', 'signup');  this.onAuthOpen.emit('signup');  }
  logout()  { localStorage.clear(); this.isLoggedIn = false; this.router.navigate(['/']); }
}