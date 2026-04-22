export type StatutDemande = 'EN_ATTENTE' | 'REJETEE' | 'APPROUVEE' ;

export interface Demande {
  id?: number;
  montantDemande: number;
  dureeMois: number;
  objet: string;
  dateDemande: string;
  scoreSolvabilite: number;
  documents: string[];
  agriculteurId: number;
  statut: StatutDemande;
  service?: { id: number };   
  serviceId?: number;
}