export type StatutEcheance = 'EN_ATTENTE' | 'PAYEE' | 'EN_RETARD';
export interface Echeance {
  id?: number;

  montant: number;

  dateDebut: string;   // ISO string (ex: 2026-04-19)
  dateFin: string;

  statut: StatutEcheance;
   pretId: number; 


}