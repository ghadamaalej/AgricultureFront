
export type StatutPret = 'ACTIF' | 'TERMINE' | 'EN_RETARD'| 'EN_ATTENTE_DECAISSEMENT';

export interface Pret {

    id?: number;

  tauxInteret: number;
  dateDebut: string;
  dateFin: string;

  montantTotal: number;
  nbEcheances: number;

  agentId: number;

  statutPret: StatutPret;

  demandeId: number;
}
