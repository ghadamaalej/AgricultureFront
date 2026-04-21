import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminOrderService {
  private apiUrl = 'http://localhost:8089/user/api/commande';

  constructor(private http: HttpClient) {}

  getAllOrders() {
  return this.http.get<any>('http://localhost:8089/Vente/api/commande/admin/all');
}

    getOrderDetails(orderId: number) {
    return this.http.get<any>(`http://localhost:8089/Vente/api/commande/admin/${orderId}/details`);
    }
}