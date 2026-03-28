export type StatutDemande = 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE';

export interface Demande {
  id?: number;

  montantDemande: number;
  dureeMois: number;
  objet: string;

  dateDemande: string; 

  scoreSolvabilite: number;

  documents: string[];

  agriculteurId: number;

  statut: 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE';

  serviceId?: number; 
}
