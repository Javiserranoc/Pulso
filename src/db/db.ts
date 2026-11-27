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
