/** Recordatorio semanal en el calendario del móvil (.ics): sustituye a las notificaciones, que en una web necesitarían servidor. */
import { addDays, dayIndex, today } from '../domain/dates';

export function planningReminderICS(appUrl: string, hour = 20, todayISO = today()): string {
  // Próximo domingo (o hoy si es domingo).
  const sunday = addDays(todayISO, (6 - dayIndex(todayISO) + 7) % 7);
  const d = sunday.replace(/-/g, '');
  const hh = String(hour).padStart(2, '0');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulso//Recordatorio//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:pulso-planificar-${d}@pulso`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${hh}0000`,
    `DTEND:${d}T${hh}1500`,
    'RRULE:FREQ=WEEKLY;BYDAY=SU',
    'SUMMARY:Planificar la semana en Pulso',
    `DESCRIPTION:Abre Pulso y planifica la semana: ${appUrl}#/plan`,
    `URL:${appUrl}#/plan`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Planificar la semana en Pulso',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}
