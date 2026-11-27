import { db, type PulsoDB } from './db';
import type { Session, Setting, Template } from '../domain/types';

const SECRET_KEYS = ['garmin', 'strava', 'proxyUrl'];

export interface Backup {
  app: 'pulso';
  version: 1;
  exportedAt: string;
  sessions: Session[];
  templates: Template[];
  settings: Setting[];
}

export async function exportAll(database: PulsoDB = db): Promise<Backup> {
  return {
    app: 'pulso',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: await database.sessions.toArray(),
    templates: await database.templates.toArray(),
    // Las claves de Garmin/Strava y el intermediario no salen del dispositivo.
    settings: (await database.settings.toArray()).filter((s) => !SECRET_KEYS.includes(s.key))
  };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === 'pulso' && Array.isArray(b.sessions) && Array.isArray(b.templates);
}

/**
 * Importa una copia. «replace» borra todo antes; «merge» añade las sesiones
 * que no existan ya (misma fecha, deporte y título).
 */
export async function importAll(backup: Backup, mode: 'replace' | 'merge', database: PulsoDB = db): Promise<number> {
  return database.transaction('rw', database.sessions, database.templates, database.settings, async () => {
    if (mode === 'replace') {
      await Promise.all([database.sessions.clear(), database.templates.clear(), database.settings.clear()]);
      await database.sessions.bulkAdd(backup.sessions.map(({ id: _id, ...s }) => s));
      await database.templates.bulkAdd(backup.templates.map(({ id: _id, ...t }) => t));
      await database.settings.bulkPut(backup.settings ?? []);
      return backup.sessions.length;
    }
    const existing = await database.sessions.toArray();
    const key = (s: Session) => `${s.date}|${s.sport}|${s.title}`;
    const seen = new Set(existing.map(key));
    const fresh = backup.sessions.filter((s) => !seen.has(key(s))).map(({ id: _id, ...s }) => s);
    await database.sessions.bulkAdd(fresh);
    const tKeys = new Set((await database.templates.toArray()).map((t) => `${t.sport}|${t.title}`));
    await database.templates.bulkAdd(backup.templates.filter((t) => !tKeys.has(`${t.sport}|${t.title}`)).map(({ id: _id, ...t }) => t));
    return fresh.length;
  });
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV para abrir en Excel o Numbers. */
export function toCSV(sessions: Session[]): string {
  const head = ['fecha', 'deporte', 'subtipo', 'titulo', 'estructura', 'distancia_m', 'duracion_s', 'zona', 'gimnasio', 'estado'];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => [s.date, s.sport, s.subtype, s.title, s.notes, s.distanceM, s.durationS, s.zone, (s.gymTags ?? []).join(' + '), s.status].map(esc).join(';'));
  return '﻿' + [head.join(';'), ...rows].join('\n');
}
