import { Component } from '@angular/core';

@Component({
  selector: 'app-testimonials',
  standalone: false,
  templateUrl: './testimonials.component.html',
  styleUrls: ['./testimonials.component.css']
})
export class TestimonialsComponent {
  activeIndex = 0;

  testimonials = [
  {
    name: 'Ahmed Ben Ali',
    role: 'Farmer',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    text: 'GreenRoots helped me connect directly with buyers and sell my produce faster. The platform is simple, efficient, and really improved my income.',
    rating: 5
  },
  {
    name: 'Sana Trabelsi',
    role: 'Local Buyer',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    text: 'I can now find fresh, local products easily. The quality is excellent and I love supporting local farmers through GreenRoots.',
    rating: 5
  },
  {
    name: 'Youssef Mahfoudh',
    role: 'Agriculture Investor',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
    text: 'GreenRoots gives me a clear view of available products and farmers. It’s a great platform for smart agricultural investment.',
    rating: 5
  },
  {
    name: 'Nour Hadded',
    role: 'Agritech Enthusiast',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    text: 'The platform is modern and very helpful for connecting farmers and buyers. It’s a big step forward for smart agriculture in Tunisia.',
    rating: 5
  }
];

  get prevIndex() {
    return (this.activeIndex - 1 + this.testimonials.length) % this.testimonials.length;
  }

  get nextIndex() {
    return (this.activeIndex + 1) % this.testimonials.length;
  }

  goTo(i: number) { this.activeIndex = i; }
  prev() { this.activeIndex = this.prevIndex; }
  next() { this.activeIndex = this.nextIndex; }

  getStars(r: number) { return Array(r).fill(0); }
}
