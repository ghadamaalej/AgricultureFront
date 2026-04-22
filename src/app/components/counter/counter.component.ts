import { Component, OnInit, ElementRef } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: false,
  templateUrl: './counter.component.html',
  styleUrls: ['./counter.component.css']
})
export class CounterComponent implements OnInit {
  animated = false;

 stats = [
  { icon: 'fas fa-users',          value: 100, suffix: '+', label: 'Active Users' },
  { icon: 'fas fa-handshake',     value: 95,    suffix: '%', label: 'Satisfaction Rate' },
  { icon: 'fas fa-map-marker-alt', value: 19,   suffix: '+', label: 'Regions Covered' },
  { icon: 'fas fa-star',           value: 4.7,   suffix: '/5', label: 'Average Rating' }
];

  displayValues: number[] = [];

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.displayValues = this.stats.map(() => 0);
    this.observeSection();
  }

  observeSection() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.animated) {
          this.animated = true;
          this.animateCounters();
        }
      });
    }, { threshold: 0.3 });

    observer.observe(this.el.nativeElement);
  }

  animateCounters() {
    this.stats.forEach((stat, i) => {
      const duration = 2000;
      const steps = 60;
      const increment = stat.value / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current = Math.min(Math.round(increment * step), stat.value);
        this.displayValues[i] = current;

        if (step >= steps) clearInterval(timer);
      }, duration / steps);
    });
  }
}
