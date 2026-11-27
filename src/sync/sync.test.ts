import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { mapFitSport, mapGarminType, mapLooseSport, mapStravaType, planMerge, type ExternalActivity } from './activities';
import { importActivities } from './apply';
import { addSession, PulsoDB, setSetting } from '../db/db';
import { exportAll } from '../db/backup';
import type { Session } from '../domain/types';

const S = (p: Partial<Session> & Pick<Session, 'date' | 'sport'>): Session => ({ id: Math.floor(Math.random() * 1e9), title: '', notes: '', status: 'planned', createdAt: 1, updatedAt: 1, ...p });
const A = (p: Partial<ExternalActivity> & Pick<ExternalActivity, 'date' | 'sport'>): ExternalActivity => ({ source: 'garmin', id: String(Math.random()), title: 'Act', ...p });

describe('tipos de deporte', () => {
  it('Garmin', () => {
    expect(mapGarminType('lap_swimming')).toEqual({ sport: 'swim', subtype: 'pool' });
    expect(mapGarminType('open_water_swimming')).toEqual({ sport: 'swim', subtype: 'open_water' });
    expect(mapGarminType('indoor_cycling')).toEqual({ sport: 'bike', subtype: 'trainer' });
    expect(mapGarminType('road_biking')).toEqual({ sport: 'bike', subtype: 'road' });
    expect(mapGarminType('treadmill_running')).toEqual({ sport: 'run' });
    expect(mapGarminType('strength_training')).toEqual({ sport: 'gym' });
    expect(mapGarminType('walking')).toBeNull();
  });
  it('Strava', () => {
    expect(mapStravaType('Ride', true)).toEqual({ sport: 'bike', subtype: 'trainer' });
    expect(mapStravaType('GravelRide')).toEqual({ sport: 'bike', subtype: 'road' });
    expect(mapStravaType('VirtualRide')).toEqual({ sport: 'bike', subtype: 'trainer' });
    expect(mapStravaType('TrailRun')).toEqual({ sport: 'run' });
    expect(mapStravaType('Swim', false, 'Travesía en el mar')).toEqual({ sport: 'swim', subtype: 'open_water' });
    expect(mapStravaType('WeightTraining')).toEqual({ sport: 'gym' });
    expect(mapStravaType('Hike')).toBeNull();
  });
  it('archivos', () => {
    expect(mapFitSport('swimming', 'lap_swimming')).toEqual({ sport: 'swim', subtype: 'pool' });
    expect(mapFitSport('cycling', 'indoor_cycling')).toEqual({ sport: 'bike', subtype: 'trainer' });
    expect(mapFitSport('training', 'strength_training')).toEqual({ sport: 'gym' });
    expect(mapLooseSport('Biking')).toEqual({ sport: 'bike', subtype: 'road' });
    expect(mapLooseSport('Running')).toEqual({ sport: 'run' });
  });
});

describe('emparejar con el plan', () => {
  it('completa la sesión planificada del mismo día y deporte, conservando título y notas', () => {
    const plan = S({ date: '2026-11-26', sport: 'swim', subtype: 'pool', title: 'Series MTT', notes: '10×100' });
    const [op] = planMerge([plan], [A({ date: '2026-11-26', sport: 'swim', subtype: 'pool', distanceM: 2350, durationS: 3108, id: '1' })]);
    expect(op).toMatchObject({ type: 'complete', id: plan.id, patch: { status: 'done', distanceM: 2350, durationS: 3108, source: 'garmin', externalId: 'garmin:1' } });
  });
  it('crea una sesión si no hay nada planificado', () => {
    const [op] = planMerge([], [A({ date: '2026-11-27', sport: 'run', distanceM: 10000, title: 'Rodaje' })]);
    expect(op).toMatchObject({ type: 'create', session: { sport: 'run', status: 'done', distanceM: 10000, title: 'Rodaje' } });
  });
  it('no repite lo ya importado ni la misma actividad venida de Garmin y Strava', () => {
    const done = S({ date: '2026-11-27', sport: 'bike', status: 'done', distanceM: 40000, durationS: 5400, source: 'garmin', externalId: 'garmin:9' });
    const ops = planMerge([done], [
      A({ date: '2026-11-27', sport: 'bike', id: '9', distanceM: 40000, durationS: 5400 }),
      A({ source: 'strava', date: '2026-11-27', sport: 'bike', id: '77', distanceM: 40100, durationS: 5410 })
    ]);
    expect(ops.map((o) => o.type === 'skip' && o.reason)).toEqual(['already', 'duplicate']);
  });
  it('dos sesiones planificadas el mismo día: cada actividad completa una', () => {
    const a = S({ date: '2026-11-26', sport: 'gym', title: 'Empuje', createdAt: 1 });
    const b = S({ date: '2026-11-26', sport: 'gym', title: 'Core', createdAt: 2 });
    const ops = planMerge([a, b], [A({ date: '2026-11-26', sport: 'gym', id: 'x', durationS: 3000 }), A({ date: '2026-11-26', sport: 'gym', id: 'y', durationS: 1200 })]);
    expect(ops.map((o) => o.type === 'complete' && o.id)).toEqual([a.id, b.id]);
  });
  it('enlaza con una sesión apuntada a mano si es la misma (distancia parecida)', () => {
    const manual = S({ date: '2026-11-26', sport: 'swim', subtype: 'pool', status: 'done', distanceM: 2400 });
    expect(planMerge([manual], [A({ date: '2026-11-26', sport: 'swim', subtype: 'pool', distanceM: 2400, durationS: 3150 })])[0]).toMatchObject({ type: 'complete', id: manual.id });
  });
  it('no toca sesiones hechas que ya tienen distancia', () => {
    const done = S({ date: '2026-11-26', sport: 'run', status: 'done', distanceM: 8000 });
    expect(planMerge([done], [A({ date: '2026-11-26', sport: 'run', distanceM: 5000, durationS: 1500 })])[0].type).toBe('create');
  });
});

describe('importar en la base de datos', () => {
  it('importa, y al repetir no duplica', async () => {
    const db = new PulsoDB('sync-test');
    await db.open();
    await addSession({ date: '2026-11-28', sport: 'run', title: '10 km Z2', notes: 'suave', status: 'planned' }, db);
    const acts = [A({ date: '2026-11-28', sport: 'run', id: 'r1', distanceM: 10120, durationS: 3300 }), A({ date: '2026-11-29', sport: 'swim', subtype: 'open_water', id: 's1', distanceM: 1800 })];
    expect(await importActivities(acts, 1, db)).toEqual({ created: 1, completed: 1, skipped: 0, ignored: 1 });
    expect(await importActivities(acts, 0, db)).toEqual({ created: 0, completed: 0, skipped: 2, ignored: 0 });
    const run = await db.sessions.where('date').equals('2026-11-28').first();
    expect(run).toMatchObject({ title: '10 km Z2', notes: 'suave', status: 'done', distanceM: 10120 });
  });
  it('una actividad importada y borrada no vuelve al sincronizar', async () => {
    const db = new PulsoDB('sync-deleted');
    await db.open();
    const acts = [A({ source: 'strava', date: '2026-11-20', sport: 'run', id: 'w1', distanceM: 3000 })];
    await importActivities(acts, 0, db);
    const s = await db.sessions.where('externalId').equals('strava:w1').first();
    const { deleteSession } = await import('../db/db');
    await deleteSession(s!.id!, db);
    expect(await importActivities(acts, 0, db)).toMatchObject({ created: 0, skipped: 1 });
  });
  it('importar una copia reemplazando conserva las conexiones', async () => {
    const db = new PulsoDB('sync-keep');
    await db.open();
    await setSetting('garmin', { apiKey: 'k' }, db);
    const { importAll } = await import('../db/backup');
    await importAll({ app: 'pulso', version: 1, exportedAt: '', sessions: [], templates: [], settings: [{ key: 'name', value: 'Ana' }] }, 'replace', db);
    expect((await db.settings.get('garmin'))?.value).toEqual({ apiKey: 'k' });
    expect((await db.settings.get('name'))?.value).toBe('Ana');
  });
  it('la copia exportada no incluye claves', async () => {
    const db = new PulsoDB('sync-secret');
    await db.open();
    await setSetting('garmin', { apiKey: 'secreto' }, db);
    await setSetting('name', 'Ana', db);
    const b = await exportAll(db);
    expect(JSON.stringify(b)).not.toContain('secreto');
    expect(b.settings.map((s) => s.key)).toEqual(['name']);
  });
});
