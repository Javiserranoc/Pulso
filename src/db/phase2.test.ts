import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addSession, applyWeekTemplate, deleteWeekTemplate, getSetting, PulsoDB, repeatWeekly, saveWeekTemplate, type WeekTemplate } from './db';
import { bestWeek } from '../domain/stats';
import { planningReminderICS } from '../lib/ics';
import type { Session } from '../domain/types';

describe('fase 2', () => {
  it('plantillas de semana: guardar, aplicar sin duplicar y borrar', async () => {
    const db = new PulsoDB('p2-tpl');
    await db.open();
    await addSession({ date: '2026-11-23', sport: 'swim', subtype: 'pool', title: 'Series MTT', notes: '', distanceM: 2400, status: 'done' }, db);
    await addSession({ date: '2026-11-25', sport: 'gym', title: 'Tracción', notes: '', gymTags: ['Tracción'], status: 'done' }, db);
    await addSession({ date: '2026-11-28', sport: 'rest', title: 'Descanso', notes: '', status: 'done' }, db);
    const tpl = await saveWeekTemplate('Semana tipo', '2026-11-26', db);
    expect(tpl.items.map((i) => [i.dow, i.sport])).toEqual([[0, 'swim'], [2, 'gym']]);
    expect(await applyWeekTemplate(tpl, '2026-12-02', db)).toBe(2);
    expect(await applyWeekTemplate(tpl, '2026-12-02', db)).toBe(0);
    expect(await db.sessions.where('date').equals('2026-12-02').first()).toMatchObject({ sport: 'gym', status: 'planned' });
    await deleteWeekTemplate('Semana tipo', db);
    expect(await getSetting<WeekTemplate[]>('weekTemplates', [], db)).toEqual([]);
  });

  it('repetir cada semana crea copias planificadas', async () => {
    const db = new PulsoDB('p2-rep');
    await db.open();
    await repeatWeekly({ date: '2026-11-29', sport: 'run', title: '8 km Z2', notes: '', distanceM: 8000, status: 'done', durationS: 2800, source: 'strava', externalId: 'strava:1' }, 3, db);
    const s = await db.sessions.orderBy('date').toArray();
    expect(s.map((x) => x.date)).toEqual(['2026-12-06', '2026-12-13', '2026-12-20']);
    expect(s.every((x) => x.status === 'planned' && !x.externalId && x.durationS == null)).toBe(true);
  });

  it('mejor semana del año', () => {
    const S = (date: string, km: number): Session => ({ date, sport: 'run', title: '', notes: '', status: 'done', distanceM: km * 1000, createdAt: 0, updatedAt: 0 });
    const all = [S('2026-11-10', 13), S('2026-11-13', 10), S('2026-11-17', 5), S('2026-11-18', 7), S('2025-12-29', 30)];
    expect(bestWeek(all, 2026, 'run')).toEqual({ monday: '2026-11-09', value: 23 });
    expect(bestWeek(all, 2025, 'run')).toEqual({ monday: '2025-12-29', value: 30 });
  });

  it('recordatorio del domingo (.ics)', () => {
    const ics = planningReminderICS('https://x.github.io/Pulso/', 20, '2026-11-27');
    expect(ics).toContain('DTSTART:20261129T200000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(ics).toContain('URL:https://x.github.io/Pulso/#/plan');
  });
});
