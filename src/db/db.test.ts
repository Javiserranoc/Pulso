import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { addSession, copyWeek, PulsoDB } from './db';
import { exportAll, importAll, toCSV } from './backup';
import { loadSampleData } from './seed';

let db: PulsoDB;
let n = 0;
beforeEach(async () => {
  db = new PulsoDB(`test-${n++}`);
  await db.open();
});

describe('base de datos local', () => {
  it('crea las plantillas de serie al abrir', async () => {
    expect(await db.templates.count()).toBeGreaterThan(5);
  });

  it('carga los datos de ejemplo: lo pasado como hecho y lo futuro como planificado', async () => {
    await loadSampleData(db, '2026-11-27');
    const done = await db.sessions.where('status').equals('done').toArray();
    const planned = await db.sessions.where('status').equals('planned').toArray();
    expect(done.every((s) => s.date < '2026-11-27')).toBe(true);
    expect(planned.map((s) => s.date).sort()[0]).toBe('2026-11-27');
  });

  it('copia una semana como planificada, sin descansos ni duplicados', async () => {
    await addSession({ date: '2026-11-23', sport: 'swim', title: 'Series MTT', notes: '', distanceM: 2400, status: 'done' }, db);
    await addSession({ date: '2026-11-28', sport: 'rest', title: 'Descanso', notes: '', status: 'done' }, db);
    expect(await copyWeek('2026-11-26', '2026-12-02', db)).toBe(1);
    expect(await copyWeek('2026-11-26', '2026-12-02', db)).toBe(0);
    const copied = await db.sessions.where('date').equals('2026-11-30').first();
    expect(copied).toMatchObject({ sport: 'swim', status: 'planned', distanceM: 2400 });
  });

  it('exporta e importa (reemplazar y fusionar)', async () => {
    await loadSampleData(db, '2026-11-27');
    const backup = await exportAll(db);
    const other = new PulsoDB(`test-${n++}`);
    await other.open();
    expect(await importAll(backup, 'replace', other)).toBe(backup.sessions.length);
    expect(await importAll(backup, 'merge', other)).toBe(0);
    expect(await other.sessions.count()).toBe(backup.sessions.length);
    expect(toCSV(backup.sessions).split('\n')).toHaveLength(backup.sessions.length + 1);
  });
});
