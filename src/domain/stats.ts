/** Acumulados. Siempre se calculan a partir de las sesiones; no se guardan aparte. */
import { DAY_LETTERS, monthGrid, MONTHS_SHORT, parseISODate, toISODate, weekDays } from './dates';
import { SPORTS, VOLUME_SPORTS } from './sports';
import { distanceIn } from './format';
import type { Session, Sport, Subtype } from './types';

export interface SportTotal {
  sport: Sport;
  /** Volumen en la unidad del deporte (m, km o nº de sesiones para gimnasio). */
  value: number;
  count: number;
  durationS: number;
  /** Volumen por subcategoría, en la unidad del deporte. */
  bySubtype: Partial<Record<Subtype, number>>;
  tags: Record<string, number>;
}

export const isDone = (s: Session) => s.status === 'done';

/** Volumen de una sesión en la unidad del deporte (gimnasio: 1 por sesión). */
export function volumeOf(s: Session): number {
  if (s.sport === 'gym') return 1;
  if (!SPORTS[s.sport].unit || s.distanceM == null) return 0;
  return distanceIn(s.sport, s.distanceM);
}

export function inRange(sessions: Session[], from: string, to: string): Session[] {
  return sessions.filter((s) => s.date >= from && s.date <= to);
}

export function totalsBySport(sessions: Session[], sports: Sport[] = VOLUME_SPORTS): Record<Sport, SportTotal> {
  const out = {} as Record<Sport, SportTotal>;
  for (const sp of sports) out[sp] = { sport: sp, value: 0, count: 0, durationS: 0, bySubtype: {}, tags: {} };
  for (const s of sessions) {
    const t = out[s.sport];
    if (!t) continue;
    const v = volumeOf(s);
    t.value += v;
    t.count += 1;
    t.durationS += s.durationS ?? 0;
    if (s.subtype) t.bySubtype[s.subtype] = (t.bySubtype[s.subtype] ?? 0) + v;
    for (const tag of s.gymTags ?? []) t.tags[tag] = (t.tags[tag] ?? 0) + 1;
  }
  return out;
}

export interface WeekProgress {
  doneSessions: number;
  totalSessions: number;
  /** 0–1: sesiones hechas sobre el total de la semana (sin contar descansos). */
  ratio: number;
  durationS: number;
  done: Record<Sport, SportTotal>;
  /** Plan = todas las sesiones de la semana, hechas o planificadas. */
  plan: Record<Sport, SportTotal>;
}

export function weekProgress(all: Session[], anyDate: string): WeekProgress {
  const days = weekDays(anyDate);
  const week = inRange(all, days[0], days[6]).filter((s) => s.sport !== 'rest');
  const done = week.filter(isDone);
  return {
    doneSessions: done.length,
    totalSessions: week.length,
    ratio: week.length ? done.length / week.length : 0,
    durationS: done.reduce((a, s) => a + (s.durationS ?? 0), 0),
    done: totalsBySport(done),
    plan: totalsBySport(week)
  };
}

export interface SeriesPoint {
  label: string;
  /** Primera subcategoría (o todo el volumen si el deporte no tiene). */
  a: number;
  /** Segunda subcategoría. */
  b: number;
  current?: boolean;
}

function splitPoint(sessions: Session[], sport: Sport, label: string, current = false): SeriesPoint {
  const subs = SPORTS[sport].subtypes;
  let a = 0;
  let b = 0;
  for (const s of sessions) {
    if (s.sport !== sport || !isDone(s)) continue;
    const v = volumeOf(s);
    if (subs.length === 2 && s.subtype === subs[1].id) b += v;
    else a += v;
  }
  return { label, a, b, current };
}

/** Volumen por día de una semana (L–D). */
export function seriesByDay(all: Session[], anyDate: string, sport: Sport, todayISO: string): SeriesPoint[] {
  return weekDays(anyDate).map((d, i) => splitPoint(all.filter((s) => s.date === d), sport, DAY_LETTERS[i], d === todayISO));
}

/** Volumen por semanas (filas del calendario) de un mes. month: 0–11. */
export function seriesByWeek(all: Session[], year: number, month: number, sport: Sport, todayISO: string): SeriesPoint[] {
  return monthGrid(year, month).map((days) => {
    const label = `${parseISODate(days[0]).getDate()}–${parseISODate(days[6]).getDate()}`;
    return splitPoint(inRange(all, days[0], days[6]), sport, label, todayISO >= days[0] && todayISO <= days[6]);
  });
}

/** Volumen por mes de un año. */
export function seriesByMonth(all: Session[], year: number, sport: Sport, todayISO: string): SeriesPoint[] {
  const cur = parseISODate(todayISO);
  return MONTHS_SHORT.map((m, i) => {
    const from = toISODate(new Date(year, i, 1, 12));
    const to = toISODate(new Date(year, i + 1, 0, 12));
    return splitPoint(inRange(all, from, to), sport, m.charAt(0).toUpperCase(), cur.getFullYear() === year && cur.getMonth() === i);
  });
}

export function yearRange(year: number): [string, string] {
  return [`${year}-01-01`, `${year}-12-31`];
}

export function monthRange(year: number, month: number): [string, string] {
  return [toISODate(new Date(year, month, 1, 12)), toISODate(new Date(year, month + 1, 0, 12))];
}

/** Mejor mes de un año para un deporte. */
export function bestMonth(all: Session[], year: number, sport: Sport): { month: number; value: number } | null {
  const pts = seriesByMonth(all, year, sport, '1900-01-01');
  let best: { month: number; value: number } | null = null;
  pts.forEach((p, i) => {
    const v = p.a + p.b;
    if (v > 0 && (!best || v > best.value)) best = { month: i, value: v };
  });
  return best;
}

/** Variación porcentual frente al año anterior hasta la misma fecha. */
export function yearOverYear(all: Session[], year: number, sport: Sport, todayISO: string): number | null {
  const cut = todayISO.slice(4); // -MM-DD
  const now = totalsBySport(inRange(all, `${year}-01-01`, `${year}${cut}`).filter(isDone))[sport]?.value ?? 0;
  const prev = totalsBySport(inRange(all, `${year - 1}-01-01`, `${year - 1}${cut}`).filter(isDone))[sport]?.value ?? 0;
  if (!prev) return null;
  return (now - prev) / prev;
}

