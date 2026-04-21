import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth/auth.service';

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

  navLinks = [
    { label: 'Home',        route: '/'            },
    { label: 'Marketplace', route: '/marketplace' },
    { label: 'Forum',       route: '/forums'      },
    { label: 'Loans',       route: '/loans'       },
    { label: 'Delivery',    route: '/delivery'    },
    { label: 'Events',      route: '/events/listEvents'},
    { label: 'Trainings',   route: '/formations'  },
  ];

  dropdownLinks = [
    { label: 'Inventory',    icon: 'fas fa-boxes',          route: '/inventory'    },
    { label: 'Appointments', icon: 'fas fa-calendar-check', route: '/appointments' },
    { label: 'Animals',      icon: 'fas fa-paw',            route: '/animals'      },
    { label: 'Help Request', icon: 'fas fa-hands-helping',  route: '/help-request' },
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.hasActiveSession();
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

  isDropdownActive(): boolean {
    return this.dropdownLinks.some(l => this.activeLink === l.route);
  }

  toggleMobile() { this.isMobileMenuOpen = !this.isMobileMenuOpen; }

  signIn()  {
    localStorage.setItem('authMode', 'signin');
    if (this.onAuthOpen.observers.length > 0) {
      this.onAuthOpen.emit('signin');
      return;
    }
    this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
  }

  signUp()  {
    localStorage.setItem('authMode', 'signup');
    if (this.onAuthOpen.observers.length > 0) {
      this.onAuthOpen.emit('signup');
      return;
    }
    this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
  }

  logout()  {
    this.authService.logout();
    this.isLoggedIn = false;
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}