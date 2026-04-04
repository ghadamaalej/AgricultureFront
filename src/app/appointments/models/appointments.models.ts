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
