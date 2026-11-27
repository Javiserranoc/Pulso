/** Utilidades de fechas. Todas trabajan con fechas locales «YYYY-MM-DD». Semanas ISO 8601 (lunes a domingo). */

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local → «YYYY-MM-DD». */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** «YYYY-MM-DD» → Date local a mediodía (evita saltos de horario de verano). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(date: string, n: number): string {
  const d = parseISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Lunes de la semana de la fecha. */
export function startOfWeek(date: string): string {
  const d = parseISODate(date);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  return addDays(date, -dow);
}

/** Los siete días (lunes→domingo) de la semana de la fecha. */
export function weekDays(date: string): string[] {
  const mon = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** Número y año de la semana ISO 8601. */
export function isoWeek(date: string): { year: number; week: number } {
  const d = parseISODate(date);
  const dow = (d.getDay() + 6) % 7;
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - dow + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4, 12);
  const jan4dow = (jan4.getDay() + 6) % 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - jan4dow);
  const week = 1 + Math.round((thursday.getTime() - week1Mon.getTime() - 3 * 864e5) / (7 * 864e5));
  return { year, week };
}

/** Filas (semanas) de un mes para el calendario: cada fila empieza en lunes. month: 0–11. */
export function monthGrid(year: number, month: number): string[][] {
  const first = toISODate(new Date(year, month, 1, 12));
  const last = toISODate(new Date(year, month + 1, 0, 12));
  const rows: string[][] = [];
  let mon = startOfWeek(first);
  while (mon <= last) {
    rows.push(weekDays(mon));
    mon = addDays(mon, 7);
  }
  return rows;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function dayIndex(date: string): number {
  return (parseISODate(date).getDay() + 6) % 7;
}

/** «Jueves, 26 de noviembre» */
export function formatLong(date: string): string {
  const d = parseISODate(date);
  return `${cap(DAYS[dayIndex(date)])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** «Jue 26» */
export function formatShort(date: string): string {
  const d = parseISODate(date);
  return `${cap(DAYS[dayIndex(date)].slice(0, 3))} ${d.getDate()}`;
}

/** «23–29 nov» o «30 nov – 6 dic» */
export function formatWeekRange(date: string): string {
  const days = weekDays(date);
  const a = parseISODate(days[0]);
  const b = parseISODate(days[6]);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export { cap as capitalize };
