import Dexie, { type EntityTable } from 'dexie';
import { BUILTIN_TEMPLATES } from '../domain/sports';
import { addDays, today, weekDays } from '../domain/dates';
import type { Session, Setting, Template } from '../domain/types';

/** Base de datos local (IndexedDB). Todo se guarda en el dispositivo. */
export class PulsoDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'pulso') {
    super(name);
    this.version(1).stores({
      sessions: '++id, date, sport, status, [date+sport]',
      templates: '++id, sport',
      settings: 'key'
    });
    this.version(2).stores({
      sessions: '++id, date, sport, status, [date+sport], externalId'
    });
    this.on('populate', (tx) => {
      tx.table('templates').bulkAdd(BUILTIN_TEMPLATES);
    });
  }
}

export const db = new PulsoDB();

type NewSession = Omit<Session, 'id' | 'createdAt' | 'updatedAt'>;

export async function addSession(s: NewSession, database = db): Promise<number> {
  const now = Date.now();
  return (await database.sessions.add({ ...s, createdAt: now, updatedAt: now })) as number;
}

export async function updateSession(id: number, patch: Partial<Session>, database = db): Promise<void> {
  await database.sessions.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteSession(id: number, database = db): Promise<void> {
  const s = await database.sessions.get(id);
  // Si venía de Garmin/Strava/archivo, se recuerda para no volver a importarla al sincronizar.
  if (s?.externalId) {
    const ignored = await getSetting<string[]>('ignoredExternal', [], database);
    if (!ignored.includes(s.externalId)) await setSetting('ignoredExternal', [...ignored, s.externalId].slice(-500), database);
  }
  await database.sessions.delete(id);
}

export async function duplicateSession(id: number, date: string, database = db): Promise<number | undefined> {
  const s = await database.sessions.get(id);
  if (!s) return undefined;
  const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = s;
  return addSession({ ...rest, date, status: date <= today() ? rest.status : 'planned' }, database);
}

/**
 * Copia las sesiones de la semana de `fromDate` a la semana de `toDate` como planificadas.
 * No copia descansos ni duplica si el destino ya tiene una sesión igual ese día.
 */
export async function copyWeek(fromDate: string, toDate: string, database = db): Promise<number> {
  const src = weekDays(fromDate);
  const dst = weekDays(toDate);
  const offset = Math.round((new Date(dst[0]).getTime() - new Date(src[0]).getTime()) / 864e5);
  const existing = await database.sessions.where('date').between(dst[0], dst[6], true, true).toArray();
  const key = (s: Pick<Session, 'date' | 'sport' | 'title'>) => `${s.date}|${s.sport}|${s.title}`;
  const seen = new Set(existing.map(key));
  const source = await database.sessions.where('date').between(src[0], src[6], true, true).toArray();
  let n = 0;
  for (const s of source) {
    if (s.sport === 'rest') continue;
    const date = addDays(s.date, offset);
    if (seen.has(key({ ...s, date }))) continue;
    await addSession({ date, sport: s.sport, subtype: s.subtype, title: s.title, notes: s.notes, distanceM: s.distanceM, gymTags: s.gymTags, zone: s.zone, status: 'planned' }, database);
    n++;
  }
  return n;
}

export async function saveTemplate(t: Omit<Template, 'id'>, database = db): Promise<number> {
  return (await database.templates.add({ ...t, builtin: false })) as number;
}

export async function getSetting<T>(key: string, fallback: T, database = db): Promise<T> {
  const s = await database.settings.get(key);
  return (s?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown, database = db): Promise<void> {
  await database.settings.put({ key, value });
}

/** Plantilla de semana completa: sesiones por día de la semana (0 = lunes). */
export interface WeekTemplate {
  name: string;
  items: { dow: number; sport: Session['sport']; subtype?: Session['subtype']; title: string; notes: string; distanceM?: number; gymTags?: string[] }[];
}

export async function saveWeekTemplate(name: string, anyDate: string, database = db): Promise<WeekTemplate> {
  const days = weekDays(anyDate);
  const sessions = await database.sessions.where('date').between(days[0], days[6], true, true).toArray();
  const tpl: WeekTemplate = {
    name: name.trim(),
    items: sessions
      .filter((s) => s.sport !== 'rest')
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      .map((s) => ({ dow: days.indexOf(s.date), sport: s.sport, subtype: s.subtype, title: s.title, notes: s.notes, distanceM: s.distanceM, gymTags: s.gymTags }))
  };
  const all = (await getSetting<WeekTemplate[]>('weekTemplates', [], database)).filter((t) => t.name !== tpl.name);
  await setSetting('weekTemplates', [...all, tpl], database);
  return tpl;
}

export async function deleteWeekTemplate(name: string, database = db): Promise<void> {
  const all = await getSetting<WeekTemplate[]>('weekTemplates', [], database);
  await setSetting('weekTemplates', all.filter((t) => t.name !== name), database);
}

/** Aplica una plantilla a la semana de `anyDate` como sesiones planificadas, sin duplicar. */
export async function applyWeekTemplate(tpl: WeekTemplate, anyDate: string, database = db): Promise<number> {
  const days = weekDays(anyDate);
  const existing = await database.sessions.where('date').between(days[0], days[6], true, true).toArray();
  const seen = new Set(existing.map((s) => `${s.date}|${s.sport}|${s.title}`));
  let n = 0;
  for (const it of tpl.items) {
    const date = days[it.dow];
    if (!date || seen.has(`${date}|${it.sport}|${it.title}`)) continue;
    await addSession({ date, sport: it.sport, subtype: it.subtype, title: it.title, notes: it.notes, distanceM: it.distanceM, gymTags: it.gymTags, status: 'planned' }, database);
    n++;
  }
  return n;
}

/** Crea la misma sesión planificada en las `weeks` semanas siguientes. */
export async function repeatWeekly(s: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>, weeks: number, database = db): Promise<number> {
  for (let k = 1; k <= weeks; k++) {
    const { source: _s, externalId: _e, durationS: _d, ...rest } = s;
    await addSession({ ...rest, date: addDays(s.date, 7 * k), status: 'planned' }, database);
  }
  return weeks;
}
