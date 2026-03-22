import { Component, HostListener, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {

  @Output() onAuthOpen = new EventEmitter<'signin' | 'signup'>();

  isScrolled       = false;
  isMobileMenuOpen = false;
  activeSection    = 'home';
  isLoggedIn       = false;

  navLinks = [
    { id: 'home',         label: 'Home' },
    { id: 'about',        label: 'About' },
    { id: 'services',     label: 'Services' },
    { id: 'products',     label: 'Products' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'blog',         label: 'Blog' }
  ];

  ngOnInit() {
    this.isLoggedIn = !!localStorage.getItem('token');
  }

  @HostListener('window:scroll', [])
  onScroll() {
    this.isScrolled = window.scrollY > 80;
    this.updateActiveSection();
  }

  updateActiveSection() {
    const sections = ['home', 'about', 'services', 'products', 'testimonials', 'blog'];
    for (const id of [...sections].reverse()) {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 100) {
        this.activeSection = id;
        break;
      }
    }
  }

  toggleMobile() { this.isMobileMenuOpen = !this.isMobileMenuOpen; }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.isMobileMenuOpen = false;
  }

  signIn() {
  localStorage.setItem('authMode', 'signin');  
  this.onAuthOpen.emit('signin');
}

signUp() {
  localStorage.setItem('authMode', 'signup'); 
  this.onAuthOpen.emit('signup');
}
  logout()  { localStorage.clear(); this.isLoggedIn = false; }
}