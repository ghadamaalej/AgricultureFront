export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  crop: string;
  notes?: string;
}

/** One cell in the month grid (local calendar UI). */
export interface CalendarDayCell {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
}

/** Values used in the app / calendar form (subset; align backend enum if you want only these). */
export type EventTypeAgricole =
  | 'SEMIS'
  | 'IRRIGATION'
  | 'FERTILISATION'
  | 'AUTRE';

export type PrioriteEvent = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';
export type StatutEvent = 'PLANIFIE' | 'FAIT' | 'ANNULE';
export type CanalNotif = 'APP' | 'EMAIL' | 'SMS';

export interface EvenementCalendrierApi {
  idEvent?: number;
  titre: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  /** Backend may still return other enum names until the Java enum is trimmed. */
  type: EventTypeAgricole | string;
  priorite: PrioriteEvent;
  statut: StatutEvent;
  userId: number;
}

export interface RappelApi {
  idRappel?: number;
  delaiAvantMinutes: number;
  canal: CanalNotif;
}

export interface WeatherForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  precipitation: number;
  evapotranspiration: number;
}

export interface IrrigationAdvice {
  date: string;
  advice: 'Irrigate' | 'Monitor' | 'Skip';
  reason: string;
}

export interface CropWindow {
  crop: string;
  plantingStart: string;
  plantingEnd: string;
  harvestStart: string;
  harvestEnd: string;
  source: 'FAO' | 'Fallback';
  /** Agro-ecological zone (FAO Tunisia) */
  aezName?: string;
  sessionNotes?: string;
}

/** Monthly summary from Open-Meteo archive (local climate context). */
export interface ClimateMonthSummary {
  month: string;
  avgTempMin: number;
  avgTempMax: number;
  totalRainMm: number;
}
