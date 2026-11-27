/**
 * Datos de ejemplo: noviembre de 2026, basados en un mes real de entrenamiento.
 * Las distancias de la semana 45 no estaban apuntadas en el Excel (su resumen estaba a 0).
 */
import { db, type PulsoDB } from './db';
import { today } from '../domain/dates';
import type { Session } from '../domain/types';

type Row = Pick<Session, 'date' | 'sport' | 'title'> & Partial<Session> & { km?: number; m?: number };

const NOV_2026: Row[] = [
  // Semana 45 · 2–8 nov
  { date: '2026-11-02', sport: 'swim', subtype: 'pool', title: 'Series MTT' },
  { date: '2026-11-03', sport: 'run', title: '40′ progresivo', notes: '40′ (3,5′ suave + 1,5′ a 4:30)' },
  { date: '2026-11-04', sport: 'gym', title: 'Torso', gymTags: ['Torso'] },
  { date: '2026-11-05', sport: 'bike', subtype: 'trainer', title: '45′ Rodillo' },
  { date: '2026-11-06', sport: 'run', title: '30′ con cambios', notes: '30′ (4,5′ suave + 30″ a 4:30)' },
  { date: '2026-11-07', sport: 'rest', title: 'Descanso' },
  { date: '2026-11-08', sport: 'race', title: 'Behobia – San Sebastián', km: 20 },
  // Semana 46 · 9–15 nov (resumen del Excel: gym 2 · nadar 2.200 m · correr 23 km)
  { date: '2026-11-09', sport: 'swim', subtype: 'pool', title: 'Series MTT', m: 2200 },
  { date: '2026-11-10', sport: 'run', title: 'Series MTT', km: 13 },
  { date: '2026-11-11', sport: 'gym', title: 'Empuje + Core', gymTags: ['Empuje', 'Core'] },
  { date: '2026-11-12', sport: 'rest', title: 'Descanso' },
  { date: '2026-11-13', sport: 'gym', title: 'Tracción + Core', gymTags: ['Tracción', 'Core'] },
  { date: '2026-11-13', sport: 'run', title: '10 km Z2', km: 10, zone: 2 },
  // Semana 47 · 16–22 nov (gym 1 · nadar 3.250 m · correr 12 km · bici 40 km)
  { date: '2026-11-17', sport: 'swim', subtype: 'pool', title: 'Series MTT', m: 1650 },
  { date: '2026-11-17', sport: 'run', title: 'Series MTT', km: 5 },
  { date: '2026-11-18', sport: 'bike', subtype: 'trainer', title: '90′ Rodillo', km: 40 },
  { date: '2026-11-18', sport: 'run', title: '7 km Z2', km: 7, zone: 2 },
  { date: '2026-11-19', sport: 'gym', title: 'Empuje + Core', gymTags: ['Empuje', 'Core'] },
  { date: '2026-11-19', sport: 'swim', subtype: 'pool', title: 'Series MTT', m: 1600 },
  // Semana 48 · 23–29 nov
  { date: '2026-11-23', sport: 'bike', subtype: 'trainer', title: '45′ Rodillo', km: 22 },
  { date: '2026-11-23', sport: 'swim', subtype: 'pool', title: 'Series MTT', m: 2500 },
  { date: '2026-11-24', sport: 'run', title: 'Series MTT', km: 8 },
  { date: '2026-11-24', sport: 'swim', subtype: 'pool', title: '1.000 m', m: 1000 },
  { date: '2026-11-25', sport: 'gym', title: 'Tracción', gymTags: ['Tracción'] },
  { date: '2026-11-25', sport: 'bike', subtype: 'road', title: '90′ Z2', km: 45, zone: 2 },
  { date: '2026-11-26', sport: 'gym', title: 'Empuje + Core', gymTags: ['Empuje', 'Core'] },
  { date: '2026-11-26', sport: 'swim', subtype: 'pool', title: 'Series MTT', m: 2400, notes: 'Calentamiento 400 · 10×100 a 1:45, rec. 20″ · 4×200 pull · 200 suave' },
  { date: '2026-11-27', sport: 'bike', subtype: 'trainer', title: '90′ Rodillo', km: 40 },
  { date: '2026-11-28', sport: 'run', title: '10 km Z2', km: 10, zone: 2 },
  { date: '2026-11-29', sport: 'run', title: '8 km Z2', km: 8, zone: 2 }
];

/** Carga noviembre de 2026. Lo anterior a hoy queda como hecho y el resto como planificado. */
export async function loadSampleData(database: PulsoDB = db, todayISO = today()): Promise<number> {
  // Todo en una sola escritura para que la pantalla no pase por estados intermedios.
  const now = Date.now();
  const rows: Session[] = NOV_2026.map((r) => {
    const { km, m, ...rest } = r;
    const distanceM = m ?? (km != null ? km * 1000 : undefined);
    return { notes: '', ...rest, distanceM, status: r.date < todayISO ? 'done' : 'planned', createdAt: now, updatedAt: now };
  });
  await database.sessions.bulkAdd(rows);
  return rows.length;
}
