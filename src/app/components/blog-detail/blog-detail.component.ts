import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-blog-detail',
  standalone: false,
  templateUrl: './blog-detail.component.html',
  styleUrls: ['./blog-detail.component.css']
})
export class BlogDetailComponent implements OnInit {

  post: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const stored = localStorage.getItem('selectedPost');
    if (stored) {
      this.post = JSON.parse(stored);
    } else {
      this.router.navigate(['/404']);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}