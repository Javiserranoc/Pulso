import { importActivities } from './apply';
import { summaryText, type ExternalActivity, type MergeSummary } from './activities';
import { fetchGarmin, getGarmin } from './garmin';
import { fetchStrava, getStrava } from './strava';

export interface SyncResult {
  summary: MergeSummary;
  errors: string[];
  text: string;
}

/** Sincroniza Garmin y Strava (los que estén configurados) y guarda en una sola pasada para no duplicar. */
export async function syncAll(days = 14): Promise<SyncResult> {
  const [g, s] = await Promise.all([getGarmin(), getStrava()]);
  const jobs: Promise<{ activities: ExternalActivity[]; ignored: number }>[] = [];
  if (g?.apiKey) jobs.push(fetchGarmin(days));
  if (s?.refreshToken) jobs.push(fetchStrava(days));
  const results = await Promise.allSettled(jobs);
  const activities: ExternalActivity[] = [];
  let ignored = 0;
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      // Garmin primero: si la misma actividad está en ambos, se queda la de Garmin.
      activities.push(...r.value.activities);
      ignored += r.value.ignored;
    } else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
  }
  activities.sort((a, b) => (a.source === b.source ? 0 : a.source === 'garmin' ? -1 : 1));
  const summary = await importActivities(activities, ignored);
  return { summary, errors, text: errors.length && !activities.length ? errors[0] : summaryText(summary) };
}

export async function hasConnections(): Promise<boolean> {
  const [g, s] = await Promise.all([getGarmin(), getStrava()]);
  return !!(g?.apiKey || s?.refreshToken);
}
