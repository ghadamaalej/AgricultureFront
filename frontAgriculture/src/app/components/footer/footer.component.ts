import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: false,
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  email = '';

  links = {
    company:  ['About Us', 'Our Team', 'Careers', 'Press', 'Contact'],
    services: ['Organic Farming', 'Crop Cultivation', 'Fresh Delivery', 'Greenhouse', 'Soil Analysis'],
    products: ['Vegetables', 'Fruits', 'Grains & Seeds', 'Herbs', 'Dairy Products']
  };

  socials = [
    { icon: 'fab fa-facebook-f',  url: '#' },
    { icon: 'fab fa-twitter',     url: '#' },
    { icon: 'fab fa-instagram',   url: '#' },
    { icon: 'fab fa-youtube',     url: '#' },
    { icon: 'fab fa-linkedin-in', url: '#' }
  ];

  subscribe() {
    if (this.email) {
      alert(`Thank you! ${this.email} subscribed successfully.`);
      this.email = '';
    }
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
