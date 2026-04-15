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


