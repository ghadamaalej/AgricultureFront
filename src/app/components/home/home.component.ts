import { Component, OnInit, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit {

  showAuth = false;
  authMode: 'signin' | 'signup' = 'signin';

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    const points = document.querySelectorAll('.why-point');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
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