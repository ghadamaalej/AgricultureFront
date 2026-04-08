import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {

  private baseUrl = 'http://localhost:8089/Vente/api/panier';
  private commandeUrl = 'http://localhost:8089/Vente/api/commande';

  cartCount$ = new BehaviorSubject<number>(0);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  addToCart(userId: number, produitId: number, quantite: number): Observable<any> {
    const params = new HttpParams()
      .set('userId', userId)
      .set('produitId', produitId)
      .set('quantite', quantite);

    return this.http.post(`${this.baseUrl}/add`, null, { params }).pipe(
      catchError(this.handleError)
    );
  }

  updateQuantity(userId: number, produitId: number, quantite: number): Observable<any> {
    const params = new HttpParams()
      .set('userId', userId)
      .set('produitId', produitId)
      .set('quantite', quantite);

    return this.http.put(`${this.baseUrl}/update`, null, { params }).pipe(
      catchError(this.handleError)
    );
  }

  removeFromCart(userId: number, produitId: number): Observable<any> {
    const params = new HttpParams()
      .set('userId', userId)
      .set('produitId', produitId);

    return this.http.delete(`${this.baseUrl}/remove`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  getPanier(userId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  getCartDetails(userId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${userId}/details`).pipe(
      catchError(this.handleError)
    );
  }

  checkout(userId: number): Observable<any> {
    const params = new HttpParams().set('userId', userId);

    return this.http.post(`${this.commandeUrl}/checkout`, null, { params }).pipe(
      catchError(this.handleError)
    );
  }

  refreshCartCount(): void {
    const currentUserId = this.authService.getCurrentUserId();

    if (!currentUserId) {
      this.cartCount$.next(0);
      return;
    }

    this.getCartDetails(currentUserId).subscribe({
      next: (data: any) => {
        const items = data?.items || [];
        const totalCount = items.length;
        this.cartCount$.next(totalCount);
      },
      error: () => {
        this.cartCount$.next(0);
      }
    });
  }

  private handleError(error: HttpErrorResponse) {
    const message =
      error.error?.message ||
      error.error ||
      'An error occurred while processing the cart.';
    return throwError(() => message);
  }
}