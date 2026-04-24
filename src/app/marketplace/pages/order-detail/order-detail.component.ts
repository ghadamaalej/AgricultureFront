import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { CartService } from '../../../services/cart/cart.service';
import { AuthService } from '../../../services/auth/auth.service';

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent implements OnInit {
  currentUserId: number | null = null;
  order: any = null;
  items: any[] = [];
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private cartService: CartService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    const orderId = Number(this.route.snapshot.paramMap.get('id'));

    if (!this.currentUserId || !orderId) return;

    this.loading = true;
    this.cartService.getPaidOrderDetails(this.currentUserId, orderId).subscribe({
      next: (res) => {
        this.order = res;
        this.items = (res.items || []).map((item: any) => ({
          ...item,
          imageUrl: item.image
            ? 'http://localhost:8090/uploads/' + item.image
            : 'assets/images/product1.jpg'
        }));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load order details', err);
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.location.back();
  }
}