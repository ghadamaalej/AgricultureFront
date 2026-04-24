export interface EventNearby {
  id:          number;
  titre:       string;
  description: string;
  type:        string;
  statut:      string;
  dateDebut:   string;
  dateFin:     string;
  lieu:        string;
  region:      string;
  montant:     number;
  image:       string;
  capaciteMax: number;
  inscrits:    number;
  latitude:    number;
  longitude:   number;
  distanceKm:  number;
  walkMinutes: number;
  bikeMinutes: number;
  carMinutes:  number;
  fillPercent: number;
}



export const TYPE_CONFIG: Record<string, { color: string; label: string; letter: string }> = {
  FAIR:          { color: '#3B6D11', label: 'Fair',           letter: 'F' },
  MARKET:        { color: '#185FA5', label: 'Market',         letter: 'M' },
  WORKSHOP:      { color: '#854F0B', label: 'Workshop',       letter: 'W' },
  DEMONSTRATION: { color: '#534AB7', label: 'Demonstration',  letter: 'D' },
};



export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
}
