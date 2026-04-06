export type ProductCategory = 'VACCIN' | 'MEDICAMENT' | 'ALIMENT' | 'RECOLTE' | 'AUTRE';
export type MovementType = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
export type Reason = 'ACHAT' | 'CONSOMMATION' | 'PERTE' | 'VENTE' | 'PRODUIT_EXPIRE' | 'VOL' | 'VACCINATION' | 'AJUSTEMENT' | 'AUTRE';

export interface UserSummary {
  id: number;
  username: string;
  email: string;
}

export interface InventoryProduct {
  id: number;
  nom: string;
  datePeremption: string | null;
  categorie: ProductCategory;
  unit: string;
  isPerishable: boolean;
  currentQuantity: number;
  minThreshold: number;
  price: number;
  owner: UserSummary;
}

export interface Batch {
  id: number;
  lotNumber: string;
  quantity: number;
  expiryDate: string | null;
  purchaseDate: string;
  note?: string | null;
}

export interface StockMovement {
  id: number;
  movementType: MovementType;
  quantity: number;
  dateMouvement: string;
  reason: Reason;
  note: string;
  productId: number;
  productName: string;
  user: UserSummary;
}

export interface Animal {
  id: number;
  espece: string;
  poids: number;
  reference: string;
  dateNaissance: string;
}

export interface AnimalDetail extends Animal {
  owner: UserSummary;
  healthRecords: any[];
  vaccinations: VaccinationRecord[];
}

export interface VaccinationRecord {
  id: number;
  vaccin: string;        // nom du vaccin (champ backend)
  dateVaccin: string;    // date vaccination (champ backend)
  dose: number;
  status: string;        // PENDING | DONE
  productId: number;
}

export interface VaccinationCampaign {
  id: number;
  espece: string;
  ageMin: number;
  ageMax: number;
  plannedDate: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  ownerId: number;
  productId: number;
  dose: number;
  productName: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

export interface CreateProductRequest {
  nom: string;
  datePeremption?: string;
  categorie: ProductCategory;
  unit: string;
  isPerishable: boolean;
  currentQuantity: number;
  minThreshold: number;
  price?: number;
}

export interface UpdateProductRequest extends CreateProductRequest {}

export interface CreateAnimalRequest {
  espece: string;
  poids: number;
  reference: string;
  dateNaissance: string;
}

export interface ConsumeStockRequest {
  quantity: number;
  reason: Reason;
  note?: string;
}

export interface AdjustStockRequest {
  quantity: number;
  note?: string;
}

export interface AddStockRequest {
  quantity: number;
  purchaseDate: string;
  expiryDate?: string | null;
  note?: string | null;
}
