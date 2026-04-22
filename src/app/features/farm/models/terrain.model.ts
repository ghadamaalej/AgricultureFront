export interface Terrain {
  idTerrain?: number;
  nom: string;
  superficie: number; // in hectares
  superficieHa?: number; // in hectares (alternative)
  localisation: string;
  coordonnees?: string; // formatted coordinates
  latitude: number;
  longitude: number;
  typeSol: string;
  irrigation: string;
  sourceEau: string;
  remarque: string;
  userId: number;
}