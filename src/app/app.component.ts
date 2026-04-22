import { Component, OnInit, HostListener } from '@angular/core';

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

    <!-- Back to Top -->
    <button class="back-to-top" [class.visible]="showBackTop" (click)="scrollTop()">
      <i class="fas fa-arrow-up"></i>
    </button>
  
    <!-- Router outlet — gère tout -->
    
    <router-outlet></router-outlet>
   
    <app-toast-stack></app-toast-stack>
   
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
      z-index: 1000; opacity: 0; transform: translateY(20px);
      transition: all 0.3s ease;
      box-shadow: 0 5px 20px rgba(76,175,80,0.4);
    }
    .back-to-top.visible { opacity: 1; transform: translateY(0); }
    .back-to-top:hover   { background: var(--primary-dark); transform: translateY(-3px); }
  `]
})
export class AppComponent implements OnInit {
  preloaderHidden = false;
  showBackTop     = false;

  ngOnInit() {
    setTimeout(() => {
      this.preloaderHidden = true;
      this.initScrollAnimations();
    }, 3000);
  }

  @HostListener('window:scroll', [])
  onScroll() {
    this.showBackTop = window.scrollY > 400;
    this.checkReveal();
  }

  scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  initScrollAnimations() { setTimeout(() => this.checkReveal(), 100); }

  checkReveal() {
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight - 80)
        el.classList.add('visible');
    });
  }
}