export type ProductCategory = 'VACCIN' | 'MEDICAMENT' | 'ALIMENT' | 'RECOLTE' | 'AUTRE';
export type MovementType = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
export type Reason = 'ACHAT' | 'CONSOMMATION' | 'PERTE' | 'VENTE' | 'PRODUIT_EXPIRE' | 'VOL' | 'VACCINATION' | 'AJUSTEMENT' | 'AUTRE';

export interface UserSummary {
  id: number;
  username: string;
  email: string;
   nom?: string;
  prenom?: string;
  region?: string;
}


export interface InventoryProduct {
  id: number;
  nom: string;
  categorie: ProductCategory;
  unit: string;
  isPerishable: boolean;
  currentQuantity: number;
  minThreshold: number;
  dateAchat?: string | null;
  datePeremption?: string | null;
  prixAchat?: number | null;
  note?: string | null;
  owner?: UserSummary;
  // Boutique fields (nullable)
  prixVente?: number | null;
  imageUrl?: string | null;
  description?: string | null;
  enBoutique?: boolean;
  enStock?: boolean;
}

export interface Batch {
  id: number;
  lotNumber: string;
  quantity: number;
  price: number;
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
  healthRecords: HealthRecord[];
  vaccinations: VaccinationRecord[];
}

export interface VaccinationRecord {
  id: number;
  vaccin: string;
  plannedDate?: string | null;
  dateVaccin?: string | null;
  dose: number;
  status: string;
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
  categorie: ProductCategory;
  unit: string;
  isPerishable: boolean;
  currentQuantity: number;
  minThreshold: number;
  dateAchat?: string | null;
  datePeremption?: string | null;
  prixAchat?: number | null;
  note?: string | null;
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
export interface UpdateAnimalRequest {
  espece: string;
  poids: number;
  dateNaissance: string;
}


export interface AdjustStockRequest {
  quantity: number;
  note?: string;
}

export interface AddStockRequest {
  quantity: number;
  // Prix achat fournisseur
  price: number;
  purchaseDate: string;
  expiryDate?: string | null;
  note?: string | null;
}

export interface ConsumeBatchRequest {
  quantity: number;
  reason: Reason;
  note?: string | null;
}
export interface HealthRecord {
  id: number;
  maladie: string;
  traitement: string;
  dateH: string;
}
