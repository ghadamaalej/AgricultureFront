import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface InventoryProduct {
  id: number;
  nom: string;
  datePeremption: string;
  categorie: 'VACCIN' | 'MEDICAMENT' | 'ALIMENT' | 'RECOLTE' | 'AUTRE';
  unit: string;
  isPerishable: boolean;
  currentQuantity: number;
  minThreshold: number;
  price: number;
  owner?: any;
}

export interface StockMovement {
  id: number;
  movementType: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  dateMouvement: string;
  reason: string;
  note: string;
  productId: number;
  productName: string;
  user?: any;
}

export interface Batch {
  id: number;
  lotNumber: string;
  quantity: number;
  expiryDate: string;
  purchaseDate: string;
}

export interface Animal {
  id: number;
  espece: string;
  poids: number;
  reference: string;
  dateNaissance: string;
}

export interface AnimalDetail extends Animal {
  owner?: any;
  healthRecords?: any[];
  vaccinations?: any[];
}

export interface VaccinationCampaign {
  id: number;
  espece: string;
  ageMin: number;
  ageMax: number;
  plannedDate: string;
  status: string;
  productId: number;
  productName: string;
  dose: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private baseUrl = 'http://localhost:8088/inventaires';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // Products
  getMyProducts(): Observable<InventoryProduct[]> {
    return this.http.get<any>(`${this.baseUrl}/api/products`, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  createProduct(data: any): Observable<InventoryProduct> {
    return this.http.post<any>(`${this.baseUrl}/api/products`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  updateProduct(id: number, data: any): Observable<InventoryProduct> {
    return this.http.put<any>(`${this.baseUrl}/api/products/${id}`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  deleteProduct(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/api/products/${id}`, { headers: this.headers() });
  }

  // Stock
  addStock(productId: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/inventory/${productId}/add-stock`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  consumeStock(productId: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/inventory/${productId}/consume`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  adjustStock(productId: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/inventory/${productId}/adjust`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  getMyMovements(): Observable<StockMovement[]> {
    return this.http.get<any>(`${this.baseUrl}/api/inventory/my-movements`, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  getBatches(productId: number): Observable<Batch[]> {
    return this.http.get<any>(`${this.baseUrl}/api/inventory/${productId}/batches`, { headers: this.headers() })
      .pipe(map(r => r.data));
  }

  // Animals
  getMyAnimals(): Observable<Animal[]> {
    return this.http.get<any>(`${this.baseUrl}/api/animals/my`, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  getAnimalDetail(id: number): Observable<AnimalDetail> {
    return this.http.get<any>(`${this.baseUrl}/api/animals/${id}/detail`, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  createAnimal(data: any): Observable<Animal> {
    return this.http.post<any>(`${this.baseUrl}/api/animals`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  updateAnimal(id: number, data: any): Observable<Animal> {
    return this.http.put<any>(`${this.baseUrl}/api/animals/${id}`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  deleteAnimal(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/api/animals/${id}`, { headers: this.headers() });
  }

  // Vaccinations
  createVaccination(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/vaccinations`, data, { headers: this.headers() })
      .pipe(map(r => r.data));
  }
  createCampaign(data: any): Observable<VaccinationCampaign> {
    return this.http.post<VaccinationCampaign>(`${this.baseUrl}/api/vaccinations/campaign`, data, { headers: this.headers() });
  }
  getAllCampaigns(): Observable<VaccinationCampaign[]> {
    return this.http.get<VaccinationCampaign[]>(`${this.baseUrl}/api/vaccinations/campaigns`, { headers: this.headers() });
  }
}
