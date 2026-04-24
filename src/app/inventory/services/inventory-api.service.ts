import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse, InventoryProduct, Batch, StockMovement,
  Animal, AnimalDetail, VaccinationCampaign,
  CreateProductRequest, UpdateProductRequest, AddStockRequest,
  CreateAnimalRequest, ConsumeStockRequest, UpdateAnimalRequest, AdjustStockRequest
} from '../models/inventory.models';
import { AuthService } from '../../services/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly backendOrigin = 'http://localhost:8088';
  private readonly contextPath = '/inventaires';
  private base = `${this.backendOrigin}${this.contextPath}/api`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

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

  updateAnimal(id: number, req: UpdateAnimalRequest): Observable<Animal> {
    return this.http.put<ApiResponse<Animal>>(
      `${this.base}/animals/${id}`, req, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  deleteAnimal(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(
      `${this.base}/animals/${id}`, { headers: this.headers() }
    ).pipe(map(() => void 0));
  }

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
  vaccinateCampaign(campaignId: number) {
  return this.http.post(
    `${this.base}/vaccinations/campaign/${campaignId}/vaccinate-all`,
    {},
    { headers: this.headers() }
  );
}

    // ── Boutique en ligne ─────────────────────────────────────────────

  /** Agriculteur: boutique publique d'un vétérinaire */
  getPublicShop(vetId: number): Observable<InventoryProduct[]> {
    return this.http.get<ApiResponse<InventoryProduct[]>>(
      `${this.base}/products/shop/vet/${vetId}`
    ).pipe(map(r => r.data));
  }

  /** Vétérinaire: mettre à jour infos boutique (prix, desc, image, visible) */
  updateBoutiqueInfo(id: number, data: {
    prixVente?: number;
    description?: string;
    enBoutique?: boolean;
  }, image?: File): Observable<InventoryProduct> {
    const fd = new FormData();
    if (data.prixVente   != null) fd.append('prixVente',   String(data.prixVente));
    if (data.description != null) fd.append('description', data.description);
    if (data.enBoutique  != null) fd.append('enBoutique',  String(data.enBoutique));
    if (image) fd.append('image', image);
    return this.http.put<ApiResponse<InventoryProduct>>(
      `${this.base}/products/${id}/boutique`, fd, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }

  /** Vétérinaire: toggle enBoutique */
  toggleBoutique(id: number): Observable<InventoryProduct> {
    return this.http.patch<ApiResponse<InventoryProduct>>(
      `${this.base}/products/${id}/boutique/toggle`, {}, { headers: this.headers() }
    ).pipe(map(r => r.data));
  }


  /** Tous les produits de toutes les boutiques vétérinaires */
  getAllPublicShop(): Observable<InventoryProduct[]> {
    return this.http.get<ApiResponse<InventoryProduct[]>>(
      `${this.base}/products/shop/all`
    ).pipe(map(r => r.data));
  }

  /** Recherche IA Groq dans la boutique globale */
  searchShopWithAI(query: string): Observable<InventoryProduct[]> {
    return this.http.post<ApiResponse<InventoryProduct[]>>(
      `${this.base}/products/shop/search-ai`, { query }
    ).pipe(map(r => r.data));
  }

  resolveMediaUrl(rawUrl?: string | null): string {
    const url = (rawUrl || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith(this.contextPath + '/')) return `${this.backendOrigin}${url}`;
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${this.backendOrigin}${this.contextPath}${normalized}`;
  }


}
