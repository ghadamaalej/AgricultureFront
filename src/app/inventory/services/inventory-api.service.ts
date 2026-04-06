import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse, InventoryProduct, Batch, StockMovement,
  Animal, AnimalDetail, VaccinationCampaign,
  CreateProductRequest, UpdateProductRequest, AddStockRequest,
  CreateAnimalRequest, ConsumeStockRequest, AdjustStockRequest
} from '../models/inventory.models';
import { AuthService } from '../../services/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private base = 'http://localhost:8088/inventaires/api'; // port 8088 + context-path /inventaires

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Products ──────────────────────────────────────────────
  getMyProducts(): Observable<InventoryProduct[]> {
    const userId = this.auth.getCurrentUserId();
    return this.http.get<ApiResponse<InventoryProduct[]>>(
      `${this.base}/products/owner/${userId}`, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  createProduct(req: CreateProductRequest): Observable<InventoryProduct> {
    return this.http.post<ApiResponse<InventoryProduct>>(
      `${this.base}/products`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  updateProduct(id: number, req: UpdateProductRequest): Observable<InventoryProduct> {
    return this.http.put<ApiResponse<InventoryProduct>>(
      `${this.base}/products/${id}`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(
      `${this.base}/products/${id}`, { headers: this.headers() }
    ).pipe(map(() => void 0));
  }

  // ── Inventory (stock ops) ─────────────────────────────────
  getProductBatches(productId: number): Observable<Batch[]> {
    return this.http.get<ApiResponse<Batch[]>>(
      `${this.base}/inventory/${productId}/batches`, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  getMyMovements(): Observable<StockMovement[]> {
    return this.http.get<ApiResponse<StockMovement[]>>(
      `${this.base}/inventory/my-movements`, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  consumeStock(productId: number, req: ConsumeStockRequest): Observable<InventoryProduct> {
    return this.http.post<ApiResponse<InventoryProduct>>(
      `${this.base}/inventory/${productId}/consume`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  adjustStock(productId: number, req: AdjustStockRequest): Observable<InventoryProduct> {
    return this.http.post<ApiResponse<InventoryProduct>>(
      `${this.base}/inventory/${productId}/adjust`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  addStock(productId: number, req: AddStockRequest): Observable<InventoryProduct> {
    return this.http.post<ApiResponse<InventoryProduct>>(
      `${this.base}/inventory/${productId}/add-stock`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  // ── Animals ───────────────────────────────────────────────
  getMyAnimals(): Observable<Animal[]> {
    return this.http.get<ApiResponse<Animal[]>>(
      `${this.base}/animals/my`, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  getAnimalDetail(id: number): Observable<AnimalDetail> {
    return this.http.get<ApiResponse<AnimalDetail>>(
      `${this.base}/animals/${id}/detail`, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  createAnimal(req: CreateAnimalRequest): Observable<Animal> {
    return this.http.post<ApiResponse<Animal>>(
      `${this.base}/animals`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  updateAnimal(id: number, req: CreateAnimalRequest): Observable<Animal> {
    return this.http.put<ApiResponse<Animal>>(
      `${this.base}/animals/${id}`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  deleteAnimal(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(
      `${this.base}/animals/${id}`, { headers: this.headers() }
    ).pipe(map(() => void 0));
  }

  // ── Vaccination Campaigns ─────────────────────────────────
  getAllCampaigns(): Observable<VaccinationCampaign[]> {
    return this.http.get<VaccinationCampaign[]>(
      `${this.base}/vaccinations/campaigns`, { headers: this.headers() }
    );
  }

  createCampaign(dto: Partial<VaccinationCampaign>): Observable<VaccinationCampaign> {
    return this.http.post<VaccinationCampaign>(
      `${this.base}/vaccinations/campaign`, dto, { headers: this.headers() }
    );
  }

  scheduleAnimalVaccination(req: any): Observable<any> {
    return this.http.post<any>(
      `${this.base}/vaccinations`, req, { headers: this.headers() }
    );
  }
}
