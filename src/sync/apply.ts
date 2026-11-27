import { db, getSetting, type PulsoDB } from '../db/db';
import { planMerge, summarize, type ExternalActivity, type MergeSummary } from './activities';

/** Guarda las actividades: completa sesiones del plan, crea las que faltan y no duplica. */
export async function importActivities(activities: ExternalActivity[], ignored = 0, database: PulsoDB = db): Promise<MergeSummary> {
  if (!activities.length) return summarize([], ignored);
  const dates = activities.map((a) => a.date).sort();
  const ignoredIds = await getSetting<string[]>('ignoredExternal', [], database);
  return database.transaction('rw', database.sessions, async () => {
    const existing = await database.sessions.where('date').between(dates[0], dates[dates.length - 1], true, true).toArray();
    // Para no duplicar entre fuentes también hay que ver ids ya importados fuera del rango.
    const keyed = await database.sessions.where('externalId').anyOf(activities.map((a) => `${a.source}:${a.id}`)).toArray();
    const all = [...existing, ...keyed.filter((k) => !existing.some((e) => e.id === k.id))];
    const ops = planMerge(all, activities, ignoredIds);
    const now = Date.now();
    for (const op of ops) {
      if (op.type === 'complete') await database.sessions.update(op.id, { ...op.patch, updatedAt: now });
      if (op.type === 'create') await database.sessions.add({ ...op.session, createdAt: now, updatedAt: now });
    }
    return summarize(ops, ignored);
  });
}
