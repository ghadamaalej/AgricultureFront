export type StatutDemande = 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE';

export interface Demande {
  id?: number;
  montantDemande: number;
  dureeMois: number;
  objet: string;
  dateDemande: string;
  scoreSolvabilite: number;
  documents: string[];
  AgriculteurId: number;
  statut: StatutDemande;
  service?: { id: number };   
  serviceId?: number;
}