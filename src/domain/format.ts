import { SPORTS } from './sports';
import type { Sport } from './types';

/** 3500 → «3.500»; 10.5 → «10,5». Separador de miles siempre, también con 4 cifras. */
export function fmtNumber(n: number, decimals = 0): string {
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decTrim = dec ? dec.replace(/0+$/, '') : '';
  return sign + grouped + (decTrim ? ',' + decTrim : '');
}

/** Distancia en la unidad del deporte (m para natación, km para el resto). */
export function distanceIn(sport: Sport, meters: number): number {
  return SPORTS[sport].unit === 'm' ? meters : meters / 1000;
}

export function fmtDistance(sport: Sport, meters?: number): string {
  if (meters == null || !SPORTS[sport].unit) return '';
  const unit = SPORTS[sport].unit!;
  const v = distanceIn(sport, meters);
  return `${fmtNumber(v, unit === 'm' ? 0 : 1)} ${unit}`;
}

/** Valor numérico sin unidad, para campos de texto. */
export function fmtDistanceValue(sport: Sport, meters?: number): string {
  if (meters == null || !SPORTS[sport].unit) return '';
  return fmtNumber(distanceIn(sport, meters), SPORTS[sport].unit === 'm' ? 0 : 2);
}

/** «2.400» (m) o «10,5» (km) → metros. Devuelve undefined si está vacío o no es válido. */
export function parseDistance(sport: Sport, text: string): number | undefined {
  const unit = SPORTS[sport].unit;
  if (!unit) return undefined;
  const t = text.trim();
  if (!t) return undefined;
  let normalized: string;
  if (unit === 'm') normalized = t.replace(/[.\s]/g, '').replace(',', '.');
  else normalized = t.replace(/\s/g, '').replace(',', '.'); // en km el punto o la coma son decimales
  const v = Number(normalized);
  if (!Number.isFinite(v) || v < 0) return undefined;
  return Math.round(unit === 'm' ? v : v * 1000);
}

/** 3150 → «52:30»; 4800 → «1:20:00». */
export function fmtDuration(seconds?: number): string {
  if (seconds == null) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}

/** «52:30» → 3150 s; «1:20:00» → 4800 s; «45» → 45 min. */
export function parseDuration(text: string): number | undefined {
  const t = text.trim().replace(/[′']/g, '');
  if (!t) return undefined;
  const parts = t.split(':').map((x) => Number(x));
  if (parts.some((x) => !Number.isFinite(x) || x < 0)) return undefined;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

/** Horas y minutos totales: «7 h 40». */
export function fmtHours(seconds: number): string {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

/** Ritmo: natación /100 m, correr /km, bici km/h. */
export function fmtPace(sport: Sport, meters?: number, seconds?: number): string {
  if (!meters || !seconds) return '';
  if (sport === 'swim') return `${fmtDuration((seconds / meters) * 100)} /100 m`;
  if (sport === 'run' || sport === 'race') return `${fmtDuration(seconds / (meters / 1000))} /km`;
  if (sport === 'bike') return `${fmtNumber(meters / 1000 / (seconds / 3600), 1)} km/h`;
  return '';
}
