/**
 * Actividades externas (Garmin, Strava, archivos) → sesiones de Pulso.
 * Todo es lógica pura para poder probarla: traducir tipos de deporte y decidir,
 * para cada actividad, si completa una sesión planificada, crea una nueva o ya estaba.
 */
import type { Session, Source, Sport, Subtype } from '../domain/types';

export interface ExternalActivity {
  source: Source;
  /** Identificador estable en origen; se guarda como «source:id». */
  id: string;
  /** Fecha local YYYY-MM-DD. */
  date: string;
  sport: Sport;
  subtype?: Subtype;
  title: string;
  distanceM?: number;
  durationS?: number;
}

type Mapped = { sport: Sport; subtype?: Subtype } | null;

/** Tipos de Garmin Connect (activityType.typeKey). */
export function mapGarminType(typeKey: string, name = ''): Mapped {
  const k = typeKey.toLowerCase();
  if (k.includes('open_water')) return { sport: 'swim', subtype: 'open_water' };
  if (k.includes('swim')) return { sport: 'swim', subtype: guessSea(name) ?? 'pool' };
  if (k.includes('indoor_cycling') || k.includes('virtual_ride') || k.includes('spin')) return { sport: 'bike', subtype: 'trainer' };
  if (k.includes('cycling') || k.includes('biking') || k.includes('ride') || k === 'cyclocross') return { sport: 'bike', subtype: 'road' };
  if (k.includes('run')) return { sport: 'run' };
  if (k.includes('strength') || k === 'hiit' || k.includes('fitness_equipment') || k.includes('indoor_cardio')) return { sport: 'gym' };
  return null;
}

/** Tipos de Strava (sport_type) y el indicador «trainer» (rodillo). */
export function mapStravaType(sportType: string, trainer = false, name = ''): Mapped {
  const k = sportType.toLowerCase();
  if (k === 'swim') return { sport: 'swim', subtype: guessSea(name) ?? 'pool' };
  if (k === 'virtualride') return { sport: 'bike', subtype: 'trainer' };
  if (k.endsWith('ride') || k === 'handcycle' || k === 'velomobile') return { sport: 'bike', subtype: trainer ? 'trainer' : 'road' };
  if (k.endsWith('run')) return { sport: 'run' };
  if (k === 'weighttraining' || k === 'crossfit' || k === 'workout' || k === 'highintensityintervaltraining') return { sport: 'gym' };
  return null;
}

/** Deporte y subdeporte de un archivo .FIT. */
export function mapFitSport(sport = '', subSport = '', name = ''): Mapped {
  const s = sport.toLowerCase();
  const sub = subSport.toLowerCase();
  if (s === 'swimming') return { sport: 'swim', subtype: sub.includes('open_water') ? 'open_water' : sub.includes('lap') ? 'pool' : guessSea(name) ?? 'pool' };
  if (s === 'cycling') return { sport: 'bike', subtype: sub.includes('indoor') || sub.includes('virtual') || sub.includes('spin') ? 'trainer' : 'road' };
  if (s === 'running' || (s === 'fitness_equipment' && sub.includes('treadmill'))) return { sport: 'run' };
  if (s === 'training' || s === 'fitness_equipment' || s === 'hiit') return { sport: 'gym' };
  return null;
}

/** Deporte libre de GPX/TCX («Running», «Biking», «swimming»…). */
export function mapLooseSport(text = '', name = ''): Mapped {
  const k = `${text} ${name}`.toLowerCase();
  if (/open.?water|aguas abiertas|\bmar\b/.test(k)) return { sport: 'swim', subtype: 'open_water' };
  if (/swim|nata|nado/.test(k)) return { sport: 'swim', subtype: 'pool' };
  if (/indoor|virtual|rodillo|trainer/.test(k) && /bik|cycl|ride|bici/.test(k)) return { sport: 'bike', subtype: 'trainer' };
  if (/bik|cycl|ride|bici/.test(k)) return { sport: 'bike', subtype: 'road' };
  if (/run|corr|carrera|trail/.test(k)) return { sport: 'run' };
  if (/strength|gym|fuerza|weight/.test(k)) return { sport: 'gym' };
  return null;
}

function guessSea(name: string): Subtype | undefined {
  return /open.?water|aguas abiertas|\bmar\b|playa|sea/i.test(name) ? 'open_water' : undefined;
}

export const externalKey = (a: Pick<ExternalActivity, 'source' | 'id'>) => `${a.source}:${a.id}`;

/** ¿Es la misma actividad vista desde dos sitios (p. ej. Garmin y Strava)? */
export function sameWorkout(s: Pick<Session, 'distanceM' | 'durationS'>, a: Pick<ExternalActivity, 'distanceM' | 'durationS'>): boolean {
  const close = (x?: number, y?: number, rel = 0.05, abs = 0) => x != null && y != null && Math.abs(x - y) <= Math.max(abs, rel * Math.max(x, y));
  if (s.durationS != null && a.durationS != null) return close(s.durationS, a.durationS, 0.05, 180);
  if (s.distanceM != null && a.distanceM != null) return close(s.distanceM, a.distanceM, 0.05, 100);
  return false;
}

export type MergeOp =
  | { type: 'skip'; reason: 'already' | 'duplicate' }
  | { type: 'complete'; id: number; patch: Partial<Session> }
  | { type: 'create'; session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> };

/**
 * Decide qué hacer con cada actividad:
 * 1. Si ya se importó (mismo externalId) → nada.
 * 2. Si es la misma que otra ya importada de otra fuente ese día → nada (Garmin y Strava a la vez).
 * 3. Si hay una sesión planificada, hecha sin datos, o apuntada a mano con la misma distancia/tiempo,
 *    del mismo día y deporte → se completa con los datos (y queda enlazada a la actividad).
 * 4. Si no, se crea como sesión hecha.
 */
export function planMerge(existing: Session[], activities: ExternalActivity[]): MergeOp[] {
  const used = new Set<number>();
  const keys = new Set(existing.map((s) => s.externalId).filter(Boolean) as string[]);
  const imported: Session[] = existing.filter((s) => s.source);
  const ops: MergeOp[] = [];
  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));

  for (const a of sorted) {
    const key = externalKey(a);
    if (keys.has(key)) {
      ops.push({ type: 'skip', reason: 'already' });
      continue;
    }
    keys.add(key);
    if (imported.some((s) => s.date === a.date && s.sport === a.sport && sameWorkout(s, a))) {
      ops.push({ type: 'skip', reason: 'duplicate' });
      continue;
    }
    const candidates = existing
      .filter((s) => s.id != null && !used.has(s.id) && s.date === a.date && s.sport === a.sport && !s.source)
      // Planificada, hecha sin datos, o hecha a mano con la misma distancia/tiempo (se enlaza, no se duplica).
      .filter((s) => s.status === 'planned' || s.distanceM == null || sameWorkout(s, a))
      .filter((s) => !a.subtype || !s.subtype || s.subtype === a.subtype || a.sport === 'swim')
      .sort((x, y) => Number(x.status !== 'planned') - Number(y.status !== 'planned') || x.createdAt - y.createdAt);
    const data = { distanceM: a.sport === 'gym' ? undefined : a.distanceM, durationS: a.durationS, source: a.source, externalId: key };
    if (candidates.length) {
      const target = candidates[0];
      used.add(target.id!);
      ops.push({ type: 'complete', id: target.id!, patch: { ...data, status: 'done', subtype: a.subtype ?? target.subtype } });
      imported.push({ ...target, ...data });
    } else {
      const session = { date: a.date, sport: a.sport, subtype: a.subtype, title: a.title, notes: '', status: 'done' as const, ...data };
      ops.push({ type: 'create', session });
      imported.push({ ...session, createdAt: 0, updatedAt: 0 });
    }
  }
  return ops;
}

export interface MergeSummary {
  created: number;
  completed: number;
  skipped: number;
  ignored: number;
}

export function summarize(ops: MergeOp[], ignored = 0): MergeSummary {
  return {
    created: ops.filter((o) => o.type === 'create').length,
    completed: ops.filter((o) => o.type === 'complete').length,
    skipped: ops.filter((o) => o.type === 'skip').length,
    ignored
  };
}

export function summaryText(s: MergeSummary): string {
  const parts: string[] = [];
  if (s.completed) parts.push(`${s.completed} ${s.completed === 1 ? 'sesión completada' : 'sesiones completadas'} del plan`);
  if (s.created) parts.push(`${s.created} ${s.created === 1 ? 'nueva' : 'nuevas'}`);
  if (s.skipped) parts.push(`${s.skipped} ya estaba${s.skipped === 1 ? '' : 'n'}`);
  if (s.ignored) parts.push(`${s.ignored} de otros deportes`);
  return parts.length ? parts.join(' · ') : 'No hay actividades nuevas';
}
