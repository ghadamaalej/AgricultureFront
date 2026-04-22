import { Component } from '@angular/core';

@Component({
  selector: 'app-services',
  standalone: false,
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.css']
})
export class ServicesComponent {
  services = [
  {
    icon: 'fas fa-store',
    title: 'Online Marketplace',
    desc: 'Farmers can list their products and track prices in real time, connecting directly with buyers across the market.',
    color: '#4caf50'
  },
  {
    icon: 'fas fa-truck',
    title: 'Transport Network',
    desc: 'Smart logistics connecting farmers with transporters — optimized routes, real-time tracking, and automated requests.',
    color: '#31bba4'
  },
  {
    icon: 'fas fa-comments',
    title: 'Expert Community',
    desc: 'Ask questions, share knowledge, and get technical advice from certified agricultural experts and specialists.',
    color: '#d0e952'
  },
  {
    icon: 'fas fa-stethoscope',
    title: 'Vet Services',
    desc: 'Online veterinary consultations, animal health tracking, and scheduled farm visits for livestock care.',
    color: '#d7c203'
  },
  {
    icon: 'fas fa-calendar-alt',
    title: 'Agri Events',
    desc: 'Discover, register, and manage agricultural training sessions, workshops, and farming events near you.',
    color: '#6c8d24'
  },
  {
  icon: 'fas fa-hand-holding-usd',
  title: 'Loan Management',
  desc: 'Apply for agricultural loans, track repayments, and monitor your financial history — all in one place.',
  color: '#795548'
}
];
}
