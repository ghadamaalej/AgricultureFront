export interface TerrainPlot {
  name:  string;
  crop:  string;
  area:  number;
  color: [number, number, number]; // RGB 0–1 floats
}

export interface Terrain {
  idTerrain?:   number;
  nom:          string;
  superficieHa: number;
  localisation: string;
  latitude:     number;
  longitude:    number;
  typeSol:      string;
  irrigation:   string;
  sourceEau:    string;
  remarque:     string;
  userId:       number;
  plots?:       TerrainPlot[]; // optional: crop planning zones
}