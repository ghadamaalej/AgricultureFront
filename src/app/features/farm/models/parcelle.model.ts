export interface Parcelle {
  id?: number;
  idParcelle?: number;
  nom: string;
  surface?: number; // in m²
  superficieHa?: number; // in hectares
  geom: string; // GeoJSON or coordinate string
  terrainId?: number;
  cultures?: Culture[];
}

export interface Culture {
  id?: number;
  idCulture?: number;
  nom: string;
  type?: string;
  espece?: string;
  variete?: string;
  dateSemis: Date | string; // ISO date string
  dateRecolte: Date | string; // ISO date string
  dateRecoltePrevue?: string; // ISO date string
  stade: StadeCulture;
  objectif?: string;
  parcelleId: number;
}

/** Corps attendu par le backend Spring (Culture) pour POST /cultures/parcelle/{id} */
export interface CultureCreatePayload {
  espece: string;
  variete?: string;
  dateSemis: string;
  dateRecoltePrevue: string;
  stade: StadeCulture;
  objectif?: string;
}

export enum StadeCulture {
  SEMIS = 'SEMIS',
  LEVEE = 'LEVEE',
  CROISSANCE = 'CROISSANCE',
  FLORAISON = 'FLORAISON',
  FRUCTIFICATION = 'FRUCTIFICATION',
  MATURATION = 'MATURATION',
  RECOLTE = 'RECOLTE'
}