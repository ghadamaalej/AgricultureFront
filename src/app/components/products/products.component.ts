import { Component } from '@angular/core';

@Component({
  selector: 'app-products',
  standalone: false,
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent {
  activeFilter = 'all';

  categories = [
    { id: 'all',        label: 'All Products' },
    { id: 'vegetables', label: 'Vegetables' },
    { id: 'fruits',     label: 'Fruits' },
    { id: 'grains',     label: 'Grains' },
    { id: 'herbs',      label: 'Herbs' }
  ];

  allProducts = [
    {
      id: 1, category: 'vegetables',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&auto=format&fit=crop',
      name: 'Fresh Spinach',       price: 3.99,  oldPrice: 5.99,  badge: 'Sale',    rating: 5, reviews: 42
    },
    {
      id: 2, category: 'fruits',
      image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop',
      name: 'Organic Strawberries', price: 6.99,  oldPrice: null,  badge: 'New',     rating: 5, reviews: 38
    },
    {
      id: 3, category: 'grains',
      image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop',
      name: 'Whole Grain Wheat',   price: 4.49,  oldPrice: null,  badge: 'Organic', rating: 4, reviews: 27
    },
    {
      id: 4, category: 'vegetables',
      image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&auto=format&fit=crop',
      name: 'Baby Tomatoes',       price: 4.99,  oldPrice: 7.99,  badge: 'Sale',    rating: 5, reviews: 56
    },
    {
      id: 5, category: 'herbs',
      image: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=400&auto=format&fit=crop',
      name: 'Fresh Basil',         price: 2.99,  oldPrice: null,  badge: 'Fresh',   rating: 4, reviews: 19
    },
    {
      id: 6, category: 'fruits',
      image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&auto=format&fit=crop',
      name: 'Red Apples',          price: 5.49,  oldPrice: null,  badge: 'Organic', rating: 5, reviews: 63
    },
    {
      id: 7, category: 'vegetables',
      image: 'https://images.unsplash.com/photo-1596768083695-1a95eed3b9c5?w=400&auto=format&fit=crop',
      name: 'Purple Eggplant',     price: 3.49,  oldPrice: null,  badge: 'Fresh',   rating: 4, reviews: 21
    },
    {
      id: 8, category: 'grains',
      image: 'https://images.unsplash.com/photo-1504113888839-1c8eb50233d3?w=400&auto=format&fit=crop',
      name: 'Organic Brown Rice',  price: 6.99,  oldPrice: 8.99,  badge: 'Sale',    rating: 5, reviews: 34
    }
  ];

  cartCount = 0;
  wishlist: number[] = [];

  get filteredProducts() {
    if (this.activeFilter === 'all') return this.allProducts;
    return this.allProducts.filter(p => p.category === this.activeFilter);
  }

  setFilter(id: string) {
    this.activeFilter = id;
  }

  addToCart(product: any) {
    this.cartCount++;
    const btn = document.querySelector(`[data-id="${product.id}"]`) as HTMLElement;
    if (btn) {
      btn.textContent = 'Added!';
      setTimeout(() => { btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart'; }, 1500);
    }
  }

  toggleWishlist(id: number) {
    const idx = this.wishlist.indexOf(id);
    if (idx === -1) this.wishlist.push(id);
    else this.wishlist.splice(idx, 1);
  }

  isWishlisted(id: number) {
    return this.wishlist.includes(id);
  }

  getStars(rating: number) {
    return Array(5).fill(0).map((_, i) => i < rating);
  }

  getBadgeClass(badge: string) {
    const map: Record<string, string> = {
      'Sale': 'badge-sale',
      'New': 'badge-new',
      'Organic': 'badge-organic',
      'Fresh': 'badge-fresh'
    };
    return map[badge] || 'badge-organic';
  }
}
