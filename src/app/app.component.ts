import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { CartService } from './services/cart/cart.service';
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

        <!-- Floating Action Button (scroll-to-top / jump-to-reply) -->
        <button
                class="back-to-top"
                [class.visible]="showBackTop"
                [class.jump-mode]="fabMode === 'jump-reply'"
                [attr.aria-label]="fabMode === 'jump-reply' ? 'Jump to reply' : 'Scroll to top'"
                (click)="onFabClick()"
        >
      <span class="fab-icon" [class.active]="fabMode === 'jump-reply'">
        <i class="fas fa-arrow-down"></i>
      </span>
            <span class="fab-label" [class.active]="fabMode === 'jump-reply'">Reply</span>
            <span class="fab-icon top-icon" [class.active]="fabMode === 'scroll-top'">
        <i class="fas fa-arrow-up"></i>
      </span>
        </button>

        <!-- Floating Cart -->
        <button
                class="floating-cart"
                routerLink="/marketplace/cart"
                *ngIf="showFloatingCart">
            <i class="fas fa-shopping-cart"></i>
            <span class="cart-badge" *ngIf="cartCount > 0">
        {{ cartCount }}
      </span>
        </button>

        <!-- Toast notifications (both implementations supported) -->
        <app-toast-legacy></app-toast-legacy>
        <app-toast-stack></app-toast-stack>

        <!-- Router outlet -->
        <router-outlet></router-outlet>

        <!-- Persistent 3D Explorer — never destroyed, CSS-toggled to preserve state -->
        <div class="explorer-overlay" [class.explorer-active]="isExplorerRoute">
            <button class="explorer-back-btn" type="button" (click)="closeExplorer()">
                <i class="fas fa-arrow-left"></i> Back to Site
            </button>
            <iframe
                    #explorerFrame
                    class="explorer-frame"
                    title="GreenRoots Explorer 3D"
                    allowfullscreen>
            </iframe>
        </div>
    `,
    styles: [`
        .preloader {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            background: white;
            display: flex; align-items: center; justify-content: center;
            flex-direction: column; z-index: 2000;
            transition: opacity 0.5s ease, visibility 0.5s;
        }
        .preloader.hidden { opacity: 0; visibility: hidden; }
        .preloader-inner  { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .preloader-gif    { width: 100px; height: 100px; margin-bottom: 20px; }
        .preloader-logo   {
            display: flex; align-items: center; gap: 10px;
            font-family: 'Playfair Display', serif;
            font-size: 32px; font-weight: 700; color: green;
        }
        .preloader-img         { width: 40px; height: 40px; object-fit: contain; }
        .preloader-logo .green { color: var(--primary); }


        .back-to-top {
            position: fixed; bottom: 30px; right: 30px;
            width: 50px; height: 50px;
            background: var(--primary); color: white; border: none;
            border-radius: 50%; cursor: pointer; font-size: 18px;
            display: flex; align-items: center; justify-content: center;
            gap: 8px;
            z-index: 1000; opacity: 0; transform: translateY(20px);
            transition: all 0.3s ease;
            box-shadow: 0 5px 20px rgba(76,175,80,0.4);
            overflow: hidden;
        }
        .back-to-top.jump-mode {
            width: 116px;
            border-radius: 999px;
            font-size: 14px;
        }
        .back-to-top.visible { opacity: 1; transform: translateY(0); }
        .back-to-top:hover   { background: var(--primary-dark); transform: translateY(-3px); }

        .fab-icon,
        .fab-label {
            opacity: 0;
            transform: translateY(4px);
            transition: opacity 0.22s ease, transform 0.22s ease;
            position: absolute;
        }
        .fab-icon.active,
        .fab-label.active {
            opacity: 1;
            transform: translateY(0);
            position: static;
        }
        .fab-label {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.3px;
            text-transform: uppercase;
        }
        .top-icon i,
        .fab-icon i { font-size: 16px; }

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

        /* ===== PERSISTENT 3D EXPLORER ===== */
        .explorer-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: none;
            flex-direction: column;
            background: #000;
        }
        .explorer-overlay.explorer-active { display: flex; }
        .explorer-back-btn {
            position: absolute;
            top: 16px;
            left: 16px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(0,0,0,0.55);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            backdrop-filter: blur(6px);
            transition: background 0.2s;
        }
        .explorer-back-btn:hover { background: rgba(0,0,0,0.8); }
        .explorer-frame {
            flex: 1;
            width: 100%;
            border: none;
        }
    `]
})
export class AppComponent implements OnInit, AfterViewInit {
    preloaderHidden  = false;
    showBackTop      = false;
    showFloatingCart = false;
    fabMode: 'jump-reply' | 'scroll-top' = 'scroll-top';
    isForumsPostPage = false;
    isExplorerRoute  = false;
    cartCount        = 0;

    @ViewChild('explorerFrame') private explorerFrame?: ElementRef<HTMLIFrameElement>;
    private explorerLoaded = false;

    private readonly explorerOrigins = new Set([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:8089',
        'http://127.0.0.1:8089',
    ]);

    private readonly folioRouteMap: Record<string, string> = {
        '/delivery':     '/delivery',
        '/forum':        '/forums',
        '/forums':       '/forums',
        '/inventory':    '/inventory',
        '/marketplace':  '/marketplace',
        '/loans':        '/loans',
        '/events':       '/events',
        '/training':     '/training',
        '/formations':   '/training',
        '/appointments': '/',
        '/animals':      '/',
        '/help-request': '/',
    };

    constructor(
        private router: Router,
        private sanitizer: DomSanitizer,
        private cartService: CartService
    ) {}

    ngOnInit() {
        setTimeout(() => {
            this.preloaderHidden = true;
            this.initScrollAnimations();
        }, 3000);

        this.cartService.cartCount$.subscribe(count => {
            this.cartCount = count;
        });

        // Initial visibility check
        this.updateFloatingCartVisibility();

        this.isForumsPostPage = this.router.url.startsWith('/forums/post/');
        this.isExplorerRoute  = this.router.url.startsWith('/explorer');

        this.router.events
            .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
            .subscribe((event: NavigationEnd) => {
                this.isForumsPostPage = event.urlAfterRedirects.startsWith('/forums/post/');
                this.isExplorerRoute  = event.urlAfterRedirects.startsWith('/explorer');
                this.updateFabState();
                this.updateFloatingCartVisibility();
                window.setTimeout(() => this.updateFabState(), 120);
            });

        this.updateFabState();
    }

    ngAfterViewInit(): void {
        if (this.explorerFrame && !this.explorerLoaded) {
            const token = localStorage.getItem('authToken');
            const base  = 'http://localhost:5173/explorer/';
            this.explorerFrame.nativeElement.src = token
                ? `${base}?token=${encodeURIComponent(token)}`
                : base;
            this.explorerLoaded = true;
        }
    }

    closeExplorer(): void {
        this.router.navigate(['/']);
    }

    @HostListener('window:message', ['$event'])
    onExplorerMessage(event: MessageEvent): void {
        if (!this.explorerOrigins.has(event.origin)) return;

        const payload = event.data as { type?: string; route?: string; path?: string; href?: string } | null;
        const isNav   = payload?.type === 'greenroots:navigate' || payload?.type === 'navigate';
        const target  = payload?.route || payload?.path || payload?.href;
        if (!payload || !isNav || typeof target !== 'string') return;

        const angular = this.resolveAngularRoute(target);
        this.router.navigateByUrl(angular);
    }

    private resolveAngularRoute(raw: string): string {
        let path = raw.trim();
        if (/^https?:\/\//i.test(path)) {
            try { path = new URL(path).pathname; } catch { path = '/'; }
        }
        path = path.split('#')[0].split('?')[0] || '/';
        if (!path.startsWith('/')) path = `/${path}`;
        return this.folioRouteMap[path] ?? '/';
    }

    @HostListener('window:scroll', [])
    onScroll() {
        this.updateFabState();
        this.checkReveal();
    }

    onFabClick() {
        if (this.fabMode === 'jump-reply') {
            this.scrollToReplyComposer();
            return;
        }
        this.scrollTop();
    }

    scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    initScrollAnimations() { setTimeout(() => this.checkReveal(), 100); }

    updateFabState() {
        const hasReplies = this.hasVisibleReplies();

        if (this.isForumsPostPage && hasReplies) {
            this.showBackTop = true;
        } else {
            this.showBackTop = window.scrollY > 400;
        }

        if (!this.isForumsPostPage) {
            this.fabMode = 'scroll-top';
            return;
        }

        const composer = document.getElementById('reply-composer');
        if (!composer) {
            this.fabMode = 'scroll-top';
            return;
        }

        const composerTop    = window.scrollY + composer.getBoundingClientRect().top;
        const viewportBottom = window.scrollY + window.innerHeight;
        this.fabMode = viewportBottom < composerTop ? 'jump-reply' : 'scroll-top';
    }

    hasVisibleReplies(): boolean {
        return document.querySelectorAll('.replies-tree .reply-branch').length > 0;
    }

    scrollToReplyComposer() {
        const composer = document.getElementById('reply-composer');
        if (!composer) {
            this.scrollTop();
            return;
        }
        composer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const textarea = composer.querySelector('textarea');
        if (textarea instanceof HTMLTextAreaElement) {
            window.setTimeout(() => textarea.focus(), 280);
        }
    }

    checkReveal() {
        document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
            if (el.getBoundingClientRect().top < window.innerHeight - 80)
                el.classList.add('visible');
        });
    }

    // Smart cart visibility
    updateFloatingCartVisibility(): void {
        const url = this.router.url;

        const token =
            localStorage.getItem('authToken') ||
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