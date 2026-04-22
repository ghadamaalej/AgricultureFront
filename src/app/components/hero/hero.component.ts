import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: false,
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.css']
})
export class HeroComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  private timer: any;

  slides = [
    {
      label: 'Welcome to GreenRoots',
      title: 'Rooted in Nature,',
      titleHighlight: ' Growing the Future',
      subtitle: 'We believe in sustainable practices that nurture the earth and feed communities.',
      bg: 'linear-gradient(135deg, rgba(27,67,50,0.82) 0%, rgba(40,100,60,0.75) 100%)',
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1600&auto=format&fit=crop'
    },
    {
      label: 'Advancing organic farming',
      title: 'Where Innovation',
      titleHighlight: 'Meets Nature',
      subtitle: 'From our fields directly to your table — 100% natural, sustainable, and grown with love.',
      bg: 'linear-gradient(135deg, rgba(20,55,40,0.85) 0%, rgba(50,90,50,0.78) 100%)',
      image: 'assets/images/ve.jpg'
    },
    {
      label: 'We grow beyond crops',
      title: 'Driving Growth ',
      titleHighlight: 'the Green Way',
      subtitle: 'Connect with farms — where every message grows collaboration and a greener tomorrow.',
      bg: 'linear-gradient(135deg, rgba(15,50,35,0.85) 0%, rgba(45,85,45,0.8) 100%)',
      image: 'assets/images/tracteur.png'
    }
  ];
 features = [
 { icon: 'fas fa-seedling', text: 'Smart Farming' },
{ icon: 'fas fa-truck', text: 'Transport Network' },
{ icon: 'fas fa-users', text: 'Expert Community' },
{ icon: 'fas fa-chart-line', text: 'Real-Time Prices' },
{ icon: 'fas fa-shield-alt', text: 'Secure Payments' },
{ icon: 'fas fa-tractor', text: 'Equipment Rental' },
{ icon: 'fas fa-stethoscope', text: 'Vet Services' },
{ icon: 'fas fa-calendar-alt', text: 'Agri Events' },
{ icon: 'fas fa-comments', text: 'Ask Experts' },
{ icon: 'fas fa-store', text: 'Online Marketplace' },
{ icon: 'fas fa-map-marker-alt', text: 'Route Optimization' },
{ icon: 'fas fa-bell', text: 'Smart Notifications' },
{ icon: 'fas fa-user-graduate', text: 'Agri Training' },
{ icon: 'fas fa-boxes-stacked', text: 'Stock Management' }
];

  ngOnInit() {
    this.startAutoplay();
    
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  startAutoplay() {
    this.timer = setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  prevSlide() {
    this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
  }

  goToSlide(i: number) {
    this.currentSlide = i;
    clearInterval(this.timer);
    this.startAutoplay();
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
