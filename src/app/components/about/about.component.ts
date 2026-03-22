import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: false,
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent {
  features = [
    { icon: 'fas fa-link',   title: 'Connect people',    desc: 'Linking farmers, buyers, experts, transporters,event organizers,agents and vets in one shared space.' },
    { icon: 'fas fa-book',    title: 'Share knowledge',      desc: 'Giving every farmer access to expert advice, training, and real-time market data.' },
    { icon: 'fas fa-truck-fast',  title: 'Streamline logistics', desc: 'Making transport, payments, and supply chains simple, fast, and reliable.' },
    { icon: 'fas fa-globe',      title: 'Grow Sustainably',  desc: 'Empowering every actor to farm more efficiently, profitably, and responsibly.' }
  ];

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
}
