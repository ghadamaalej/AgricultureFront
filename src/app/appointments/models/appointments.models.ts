export type AppointmentStatus = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'ANNULEE';
export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';

export interface VetUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  photo: string | null;
  region: string | null;
  role: string;
  adresseCabinet: string | null;
  presentationCarriere: string | null;
  telephoneCabinet: string | null;
}

export interface UserSummary {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: string;
}

export interface AnimalSummary {
  id: number;
  espece: string;
  poids: number;
  reference: string;
  dateNaissance: string;
}

export interface TimeSlot {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  status: SlotStatus;
}

export interface VetAvailability {
  id: number;
  date: string;
  bookedSlots: number;
  veterinarian: UserSummary | null;
  timeSlots: TimeSlot[];
}

export interface AppointmentResponse {
  id: number;
  dateHeure: string;
  motif: string;
  reason: string | null;
  refusalReason: string | null;
  createdAt: string;
  appointmentStatus: AppointmentStatus;
  farmer: UserSummary | null;
  veterinarian: UserSummary | null;
  animal: AnimalSummary | null;
  timeSlot: TimeSlot | null;
}

export interface UnavailabilityResponse {
  id: number;
  veterinarianId: number;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  fullDay: boolean;
  recurringWeekly: boolean;
  dayOfWeek: string | null;
  reason: string | null;
}

export interface CreateAppointmentRequest {
  veterinarianId: number;
  animalId: number;
  timeSlotId: number;
  motif: string;
  reason?: string;
}

export interface CreateAvailabilityRequest {
  date: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

export interface CreateUnavailabilityRequest {
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  fullDay: boolean;
  recurringWeekly: boolean;
  dayOfWeek?: string | null;
  reason?: string | null;
}

// ── Health Records ────────────────────────────────────────────
export interface HealthRecord {
  id: number;
  maladie: string;
  traitement: string;
  dateH: string;
  animal: AnimalSummary | null;
}

export interface CreateHealthRecordRequest {
  maladie: string;
  traitement: string;
  dateH: string;
  animalId: number;
}

export interface UpdateHealthRecordRequest {
  maladie: string;
  traitement: string;
  dateH: string;
}


export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  receiverId: number;
  content: string;
  sentAt: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
}

export interface ChatConversation {
  id: number;
  farmer: UserSummary | null;
  veterinarian: UserSummary | null;
  otherParticipant: UserSummary | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}
export interface AppointmentStats {
  totalAppointments: number;
  pendingAppointments: number;
  acceptedAppointments: number;
  refusedAppointments: number;
  cancelledAppointments: number;
  todayAppointments: number;
  upcomingAppointments: number;
  distinctAnimals: number;
}



export interface DiagnosticAssistantChatRequest {
  animalType?: string;
  symptom1?: string;
  symptom2?: string;
  symptom3?: string;
  duration?: string;
  bodyTemperature?: string;
  question: string;
}
export interface DiseasePrediction {
  rank: number;
  disease: string;
  probability: number;
}

export interface DiagnosticResponse {
  animalReference: string;
  animalEspece: string;
  predictions: DiseasePrediction[];
  geminiAnalysis: string;
  assistantAnalysis?: string;
  disclaimer: string;
}

export interface DiagnosticChatResponse {
  answer: string;
}
export interface DiagnosticRequest {
  animalId: number;
  symptom1: string;
  symptom2?: string;
  symptom3?: string;
  duration: string;
  bodyTemperature?: string;
  question?: string;
}

export interface MedicalAssistantRequest {
  question: string;
}

export interface MedicalAssistantResponse {
  answer: string;
  aiProvider: string;
  aiModel: string;
  medicalSummary: string;
  lastDisease: string;
  recordCount: number;
  usedContext: string[];
}

export interface ImageDiseasePrediction {
  rank: number;
  disease: string;
  probability: number;
}

export interface ImageChatbotResponse {
  predictedLabel: string;
  confidence: number;
  predictions: ImageDiseasePrediction[];
  analysis: string;
  disclaimer: string;
  trainingSummary: {
    val_accuracy?: number;
    class_names?: string[];
    class_counts?: Record<string, number>;
  }
  
  
  ;

  
}


export interface AvisResponse {
  id: number;
  note: number;
  commentaire: string;
  agriculteurId: number;
  agriculteurNom: string;
  agriculteurPrenom: string;
  agriculteurPhoto: string | null;
  veterinarianId: number;
  createdAt: string;
  reponseVet: ReponseAvisResponse | null;
  commentaires: CommentaireAvisResponse[];
  nbLikes: number;
  likedByMe: boolean;
}
export interface ReponseAvisResponse { id: number; contenu: string; veterinarianId: number; vetNom: string; vetPrenom: string; vetPhoto: string | null; createdAt: string; }
export interface CommentaireAvisResponse { id: number; contenu: string; agriculteurId: number; agriculteurNom: string; agriculteurPrenom: string; agriculteurPhoto: string | null; createdAt: string; }
export interface VetRatingSummary { veterinarianId: number; moyenneNote: number; totalAvis: number; distribution: { [key: number]: number }; }
export interface CreateAvisRequest { note: number; commentaire: string; veterinarianId: number; }

/** Réponse officielle du vétérinaire à un avis */
export interface ReponseAvisResponse {
  id: number;
  contenu: string;
  veterinarianId: number;
  vetNom: string;
  vetPrenom: string;
  vetPhoto: string | null;
  createdAt: string;
}

/** Commentaire d'un agriculteur sur un avis */
export interface CommentaireAvisResponse {
  id: number;
  contenu: string;
  agriculteurId: number;
  agriculteurNom: string;
  agriculteurPrenom: string;
  agriculteurPhoto: string | null;
  createdAt: string;
}

/** Avis complet d'un agriculteur sur un vétérinaire */
export interface AvisResponse {
  id: number;
  note: number;              // 1 à 5 étoiles
  commentaire: string;
  agriculteurId: number;
  agriculteurNom: string;
  agriculteurPrenom: string;
  agriculteurPhoto: string | null;
  veterinarianId: number;
  createdAt: string;
  reponseVet: ReponseAvisResponse | null;   // réponse du vétérinaire
  commentaires: CommentaireAvisResponse[];  // réponses des autres agriculteurs
  nbLikes: number;
  likedByMe: boolean;   // true si l'utilisateur courant a liké cet avis
}

/** Résumé des évaluations d'un vétérinaire */
export interface VetRatingSummary {
  veterinarianId: number;
  moyenneNote: number;      // ex: 4.3
  totalAvis: number;
  distribution: { [key: number]: number };  // { 1: 2, 2: 1, 3: 4, 4: 8, 5: 12 }
}

/** Requête de création d'un avis */
export interface CreateAvisRequest {
  note: number;         // 1-5
  commentaire: string;
  veterinarianId: number;
}



