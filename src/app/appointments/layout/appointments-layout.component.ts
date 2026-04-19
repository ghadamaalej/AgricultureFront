import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-appointments-layout',
  standalone: false,
  templateUrl: './appointments-layout.component.html',
  styleUrls: ['./appointments-layout.component.css']
})
export class AppointmentsLayoutComponent implements OnInit {
  role = '';
    view = 'list'; // list | book | diagnostic | ai-farmer | ai-vet | avail | profile | records | messages

  constructor(private auth: AuthService, private router: Router) {}
  ngOnInit() {
    this.role = this.auth.getCurrentRole() || '';
    // Support pre-selected view from localStorage (e.g. "Prendre RDV" button)
    const saved = localStorage.getItem('apptDefaultView');
    if (saved) { this.view = saved; localStorage.removeItem('apptDefaultView'); }
  }

  get user()     { return this.auth.getCurrentUser(); }
  get isVet()    { return this.role === 'VETERINAIRE'; }
  get isFarmer() { return this.role === 'AGRICULTEUR'; }

  setView(v: string) { this.view = v; }
  goBack()  { this.router.navigate(['/inventory']); }
  logout()  { this.auth.logout(); this.router.navigate(['/']); }
}
