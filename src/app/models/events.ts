export interface Events {
    id: number;
    titre: string;
    description: string;
    type: string;
    dateDebut: string;
    dateFin: string;
    lieu: string;
    montant: number;
    image: string;
    region: string;
    capaciteMax: number;
    inscrits: number;
    statut: string; 
    autorisationmunicipale?: string;
    isValid: boolean | null;

}

