import { Component, OnInit, HostListener } from '@angular/core';
import { CartService } from './services/cart/cart.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';


@Component({
  selector: 'app-root',
  standalone: false,
  template: `
    <!-- Preloader -->
    <div class="preloader" [class.hidden]="preloaderHidden">
      <div class="preloader-inner">
        <img src="assets/images/loader1.gif" alt="Loading..." class="preloader-gif">
        <div class="preloader-logo">
          <img src="assets/images/logo.png" alt="Logo" class="preloader-img">
          <span><span class="green">Green</span>Roots</span>
        </div>
      </div>
    </div>

    <button
      class="floating-cart"
      routerLink="/marketplace/cart"
      *ngIf="showFloatingCart">
      <i class="fas fa-shopping-cart"></i>

      <span class="cart-badge" *ngIf="cartCount > 0">
        {{ cartCount }}
      </span>
    </button>

    <!-- Back to Top -->
    <button class="back-to-top" [class.visible]="showBackTop" (click)="scrollTop()">
      <i class="fas fa-arrow-up"></i>
    </button>

    <!-- Router outlet -->
    <router-outlet></router-outlet>
  `,
  styles: [`
    .preloader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      z-index: 2000;
      transition: opacity 0.5s ease, visibility 0.5s;
    }

    .preloader.hidden {
      opacity: 0;
      visibility: hidden;
    }

    .preloader-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .preloader-gif {
      width: 100px;
      height: 100px;
      margin-bottom: 20px;
    }

    .preloader-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      font-weight: 700;
      color: green;
    }

    .preloader-img {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }

    .preloader-logo .green {
      color: var(--primary);
    }

    .back-to-top {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 50px;
      height: 50px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      box-shadow: 0 5px 20px rgba(76,175,80,0.4);
    }

    .back-to-top.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .back-to-top:hover {
      background: var(--primary-dark);
      transform: translateY(-3px);
    }

    .floating-cart {
      position: fixed;
      bottom: 95px;
      right: 30px;
      width: 50px;
      height: 50px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      transition: all 0.3s ease;
      box-shadow: 0 5px 20px rgba(76,175,80,0.4);
    }

    .floating-cart:hover {
      background: var(--primary-dark);
      transform: translateY(-3px);
    }

    .cart-badge {
      position: absolute;
      top: -6px;
      right: -4px;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: #dc3545;
      color: white;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(220, 53, 69, 0.3);
    }
  `]
})
export class AppComponent implements OnInit {
  preloaderHidden = false;
  showBackTop = false;
  cartCount = 0;
  showFloatingCart = false;

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit() {
    setTimeout(() => {
      this.preloaderHidden = true;
      this.initScrollAnimations();
    }, 3000);

    this.cartService.cartCount$.subscribe(count => {
      this.cartCount = count;
    });

    this.updateFloatingCartVisibility();

this.router.events
  .pipe(filter(event => event instanceof NavigationEnd))
  .subscribe(() => {
    this.updateFloatingCartVisibility();
  });
  }

  @HostListener('window:scroll', [])
  onScroll() {
    this.showBackTop = window.scrollY > 400;
    this.checkReveal();
  }

  scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  initScrollAnimations() {
    setTimeout(() => this.checkReveal(), 100);
  }

  checkReveal() {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight - 80) {
        el.classList.add('visible');
      }
    });
  }

  updateFloatingCartVisibility(): void {
  const url = this.router.url;

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('jwt') ||
    localStorage.getItem('accessToken');

  const user =
    localStorage.getItem('currentUser') ||
    localStorage.getItem('user') ||
    localStorage.getItem('authUser');

  const isLoggedIn = !!token || !!user;

  const hiddenRoutes =
    url === '/' ||
    url.startsWith('/auth') ||
    url.startsWith('/dashboard') ||
    url.includes('/marketplace/rental-contract/');

  this.showFloatingCart = isLoggedIn && !hiddenRoutes;

  if (this.showFloatingCart) {
    this.cartService.refreshCartCount();
  } else {
    this.cartCount = 0;
  }
}
}