import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService, BackendRole } from '../../services/auth/auth.service';

@Component({
  selector: 'app-role-home-placeholder',
  standalone: false,
  templateUrl: './role-home-placeholder.component.html',
  styleUrls: ['./role-home-placeholder.component.css']
})
export class RoleHomePlaceholderComponent implements OnInit {
  homeLabel = 'role home';
  currentRole: BackendRole | null = null;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.homeLabel = this.route.snapshot.data['homeLabel'] || 'role home';
    this.currentRole = this.authService.getCurrentRole();
  }
}
