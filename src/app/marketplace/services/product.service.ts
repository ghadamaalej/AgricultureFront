import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private apiUrl = 'http://localhost:8089/Vente/produitAgricoles'; 

  constructor(private http: HttpClient) {}

  // 🔹 GET all products
  getAll() {
    return this.http.get('http://localhost:8089/Vente/produitAgricoles?size=100');
  }

  // 🔹 GET one product
  getById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  // 🔹 CREATE product
  create(product: any) {
  return this.http.post('http://localhost:8089/Vente/produitAgricoles', product);
  }

  // 🔹 DELETE product
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return this.http.post('http://localhost:8090/upload', formData, {
    responseType: 'text'
  });
}
  update(id: number, product: any) {
    return this.http.put(
      `http://localhost:8089/Vente/produitAgricoles/${id}`,
      product
    );
  }

  getAIRecommendations(productId: number) {
  return this.http.get<any[]>(
    `http://localhost:8089/Vente/api/ai/product-recommend/${productId}`
  );
}
}