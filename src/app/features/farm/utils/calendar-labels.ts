import { EventTypeAgricole } from '../models/calendar.model';

export const EVENT_TYPE_OPTIONS: { value: EventTypeAgricole; label: string }[] = [
  { value: 'SEMIS', label: 'Semis' },
  { value: 'IRRIGATION', label: 'Irrigation' },
  { value: 'FERTILISATION', label: 'Fertilisation' },
  { value: 'AUTRE', label: 'Autre' }
];

export function getEventTypeLabel(code: string): string {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === code)?.label ?? code;
}
