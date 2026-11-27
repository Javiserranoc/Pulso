import { describe, expect, it } from 'vitest';
import { addDays, formatLong, formatWeekRange, isoWeek, monthGrid, startOfWeek, weekDays } from './dates';
import { fmtDistance, fmtDuration, fmtNumber, fmtPace, parseDistance, parseDuration } from './format';
import { bestMonth, seriesByMonth, seriesByWeek, totalsBySport, weekProgress, yearOverYear } from './stats';
import type { Session } from './types';

const S = (p: Partial<Session> & Pick<Session, 'date' | 'sport'>): Session => ({
  title: '', notes: '', status: 'done', createdAt: 0, updatedAt: 0, ...p
});

describe('fechas', () => {
  it('semanas ISO, incluidos cambios de año', () => {
    expect(isoWeek('2026-11-26')).toEqual({ year: 2026, week: 48 });
    expect(isoWeek('2026-11-02')).toEqual({ year: 2026, week: 45 });
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
    expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek('2024-12-30')).toEqual({ year: 2025, week: 1 });
    expect(isoWeek('2021-01-03')).toEqual({ year: 2020, week: 53 });
  });
  it('lunes a domingo', () => {
    expect(startOfWeek('2026-11-26')).toBe('2026-11-23');
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23');
    expect(weekDays('2026-11-30')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // cambio de hora
  });
  it('rejilla del mes', () => {
    const g = monthGrid(2026, 10);
    expect(g).toHaveLength(6);
    expect(g[0][0]).toBe('2026-10-26');
    expect(g[5][0]).toBe('2026-11-30');
  });
  it('textos', () => {
    expect(formatLong('2026-11-26')).toBe('Jueves, 26 de noviembre');
    expect(formatWeekRange('2026-11-26')).toBe('23–29 nov');
    expect(formatWeekRange('2026-12-01')).toBe('30 nov – 6 dic');
  });
});

describe('formatos', () => {
  it('números con punto de miles', () => {
    expect(fmtNumber(3500)).toBe('3.500');
    expect(fmtNumber(1240)).toBe('1.240');
    expect(fmtNumber(10.5, 1)).toBe('10,5');
    expect(fmtNumber(8, 1)).toBe('8');
  });
  it('distancias por deporte', () => {
    expect(fmtDistance('swim', 2400)).toBe('2.400 m');
    expect(fmtDistance('run', 10500)).toBe('10,5 km');
    expect(parseDistance('swim', '2.400')).toBe(2400);
    expect(parseDistance('run', '10,5')).toBe(10500);
    expect(parseDistance('bike', '45.5')).toBe(45500);
    expect(parseDistance('run', '')).toBeUndefined();
    expect(parseDistance('gym', '3')).toBeUndefined();
  });
  it('tiempos y ritmos', () => {
    expect(parseDuration('52:30')).toBe(3150);
    expect(parseDuration('1:20:00')).toBe(4800);
    expect(parseDuration('45')).toBe(2700);
    expect(fmtDuration(3150)).toBe('52:30');
    expect(fmtDuration(4800)).toBe('1:20:00');
    expect(fmtPace('swim', 2400, 3150)).toBe('2:11 /100 m');
    expect(fmtPace('run', 10000, 3000)).toBe('5:00 /km');
    expect(fmtPace('bike', 45000, 5400)).toBe('30 km/h');
  });
});

describe('acumulados', () => {
  const data: Session[] = [
    S({ date: '2026-11-23', sport: 'swim', subtype: 'pool', distanceM: 2500 }),
    S({ date: '2026-11-24', sport: 'swim', subtype: 'pool', distanceM: 1000 }),
    S({ date: '2026-11-25', sport: 'swim', subtype: 'open_water', distanceM: 2000, status: 'planned' }),
    S({ date: '2026-11-24', sport: 'run', distanceM: 8000, durationS: 2400 }),
    S({ date: '2026-11-23', sport: 'bike', subtype: 'trainer', distanceM: 22000 }),
    S({ date: '2026-11-25', sport: 'bike', subtype: 'road', distanceM: 45000 }),
    S({ date: '2026-11-25', sport: 'gym', gymTags: ['Tracción'] }),
    S({ date: '2026-11-28', sport: 'rest' }),
    S({ date: '2025-11-10', sport: 'swim', subtype: 'pool', distanceM: 3000 })
  ];
  it('totales por deporte y subcategoría', () => {
    const t = totalsBySport(data.filter((s) => s.status === 'done' && s.date >= '2026-11-23'));
    expect(t.swim.value).toBe(3500);
    expect(t.swim.bySubtype.pool).toBe(3500);
    expect(t.bike.value).toBe(67);
    expect(t.bike.bySubtype.trainer).toBe(22);
    expect(t.gym.value).toBe(1);
    expect(t.gym.tags.Tracción).toBe(1);
  });
  it('progreso semanal: hecho frente a plan, sin contar descansos', () => {
    const w = weekProgress(data, '2026-11-26');
    expect(w.totalSessions).toBe(7);
    expect(w.doneSessions).toBe(6);
    expect(w.plan.swim.value).toBe(5500);
    expect(w.done.swim.value).toBe(3500);
    expect(w.durationS).toBe(2400);
  });
  it('series por semana y por mes, separando subcategorías', () => {
    const weeks = seriesByWeek(data, 2026, 10, 'bike', '2026-11-26');
    expect(weeks[4]).toMatchObject({ label: '23–29', a: 45, b: 22, current: true });
    const months = seriesByMonth(data, 2026, 'swim', '2026-11-26');
    expect(months[10]).toMatchObject({ a: 3500, b: 0, current: true });
    expect(bestMonth(data, 2026, 'swim')).toEqual({ month: 10, value: 3500 });
    expect(yearOverYear(data, 2026, 'swim', '2026-11-26')).toBeCloseTo(3500 / 3000 - 1);
  });
});
