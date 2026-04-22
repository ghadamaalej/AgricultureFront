import { Institution } from './institution';

export interface Service {
  id: number;

  nom: string;
  description: string;

  montantMax: number;
  montantMin: number;
  dureeMaxMois: number;

  tauxInteret: number;
  tauxPenalite: number;

  criteresEligibilite: string;
  documentsRequis: string;
  delaiTraitement: string;

  agentId: number;
  nombreDemandes?: number;
  institution: Institution;
}
