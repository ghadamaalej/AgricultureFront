export type ReclamationStatus = 'EN_ATTENTE' | 'EN_COURS' | 'RESOLUE' | 'REJETEE';
export type ReclamationCategory = 'COMMANDE' | 'LIVRAISON' | 'PAIEMENT' | 'COMPTE' | 'RENDEZ_VOUS' | 'INVENTAIRE' | 'AUTRE';
export type ReclamationPriority = 'BASSE' | 'MOYENNE' | 'HAUTE';
export type SenderRole = 'USER' | 'ADMIN';

export interface ReclamationMessageResponse {
  id: number;
  senderId: number;
  senderName: string;
  senderRole: SenderRole;
  message: string;
  createdAt: string;
}

export interface ReclamationResponse {
  id: number;
  userId: number;
  userFullName: string;
  userEmail: string;
  subject: string;
  category: ReclamationCategory;
  description: string;
  status: ReclamationStatus;
  priority: ReclamationPriority;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messages: ReclamationMessageResponse[];
}

export interface CreateReclamationRequest {
  userId: number;
  subject: string;
  category: ReclamationCategory;
  description: string;
  priority: ReclamationPriority;
}

export interface AddMessageRequest {
  senderId: number;
  senderRole: SenderRole;
  message: string;
}

export interface UpdateStatusRequest {
  status: ReclamationStatus;
}

export const STATUS_LABELS: Record<ReclamationStatus, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  RESOLUE: 'Résolue',
  REJETEE: 'Rejetée'
};

export const CATEGORY_LABELS: Record<ReclamationCategory, string> = {
  COMMANDE: 'Commande',
  LIVRAISON: 'Livraison',
  PAIEMENT: 'Paiement',
  COMPTE: 'Compte',
  RENDEZ_VOUS: 'Rendez-vous',
  INVENTAIRE: 'Inventaire',
  AUTRE: 'Autre'
};

export const PRIORITY_LABELS: Record<ReclamationPriority, string> = {
  BASSE: 'Basse',
  MOYENNE: 'Moyenne',
  HAUTE: 'Haute'
};
