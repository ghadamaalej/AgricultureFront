import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit {

  showAuth = false;
  authMode: 'signin' | 'signup' = 'signin';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Scroll vers la section si un fragment est passé dans l'URL
    this.route.fragment.subscribe(fragment => {
      if (fragment) {
        setTimeout(() => {
          document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    });

    this.route.queryParamMap
      .pipe(filter((params) => params.has('openAuth')))
      .subscribe((params) => {
        const open = params.get('openAuth');
        if (open === 'signin' || open === 'signup') {
          this.openAuth(open);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { openAuth: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
        }
      });
  }

  ngAfterViewInit(): void {
    const points = document.querySelectorAll('.why-point');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.2 });
    points.forEach(p => observer.observe(p));
  }

  openAuth(mode: 'signin' | 'signup') {
    this.authMode = mode;
    this.showAuth = true;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  closeAuth() {
    this.showAuth = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}