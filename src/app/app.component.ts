import { Component, OnInit, HostListener } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

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

    <!-- Floating Action -->
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

    <!-- Router outlet — gère tout -->
    <router-outlet></router-outlet>
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
    .fab-icon i {
      font-size: 16px;
    }
  `]
})
export class AppComponent implements OnInit {
  preloaderHidden = false;
  showBackTop     = false;
  fabMode: 'jump-reply' | 'scroll-top' = 'scroll-top';
  isForumsPostPage = false;

  constructor(private router: Router) {}

  ngOnInit() {
    setTimeout(() => {
      this.preloaderHidden = true;
      this.initScrollAnimations();
    }, 3000);

    this.isForumsPostPage = this.router.url.startsWith('/forums/post/');
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.isForumsPostPage = event.urlAfterRedirects.startsWith('/forums/post/');
        this.updateFabState();
        window.setTimeout(() => this.updateFabState(), 120);
      }
    });

    this.updateFabState();
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

    const composerTop = window.scrollY + composer.getBoundingClientRect().top;
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
}