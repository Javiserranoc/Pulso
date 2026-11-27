/**
 * Garmin Connect · API personal (solo lectura, la cuenta del propio usuario).
 * La clave se crea en Garmin Connect (web) → Ajustes → Personal API Key y se guarda solo en este dispositivo.
 * Clave → token de 24 h (sin refresco: se vuelve a pedir con la clave) → lista de actividades.
 */
import { getSetting, setSetting } from '../db/db';
import { addDays, today } from '../domain/dates';
import { mapGarminType, type ExternalActivity } from './activities';
import { apiFetch, expectOk, SyncError } from './net';
import { toRoute } from '../domain/route';

const BASE = 'https://personal.connectapi.garmin.com';

export interface GarminConfig {
  apiKey: string;
  token?: string;
  tokenExp?: number; // ms
  lastSync?: string;
}

export const getGarmin = () => getSetting<GarminConfig | null>('garmin', null);
export const saveGarmin = (c: GarminConfig | null) => setSetting('garmin', c);

function jwtExp(token: string): number | undefined {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

async function token(cfg: GarminConfig): Promise<string> {
  if (cfg.token && cfg.tokenExp && cfg.tokenExp - Date.now() > 10 * 60_000) return cfg.token;
  const res = await expectOk(
    await apiFetch(`${BASE}/personalapitoken-service/personal-api/personal-api-key/token`, { method: 'POST', headers: { Authorization: `ApiKey ${cfg.apiKey.trim()}` } }),
    'Garmin'
  );
  const raw = (await res.text()).trim();
  let t = raw;
  if (raw.startsWith('{')) {
    const j = JSON.parse(raw);
    t = j.access_token ?? j.accessToken ?? j.token ?? '';
  }
  if (!t) throw new SyncError('Garmin no devolvió un token.', 'auth');
  await saveGarmin({ ...cfg, token: t, tokenExp: jwtExp(t) ?? Date.now() + 23 * 3600_000 });
  return t;
}

interface GarminActivity {
  activityId?: number | string;
  activityName?: string;
  startTimeLocal?: string;
  startTimeGMT?: string;
  activityType?: { typeKey?: string };
  distance?: number;
  duration?: number;
  movingDuration?: number;
}

/** Actividades de los últimos `days` días ya traducidas a Pulso. */
export async function fetchGarmin(days = 30): Promise<{ activities: ExternalActivity[]; ignored: number }> {
  const cfg = await getGarmin();
  if (!cfg?.apiKey) throw new SyncError('Falta la clave de Garmin.', 'config');
  const params = new URLSearchParams({ start: '0', limit: '100', startDate: addDays(today(), -days), endDate: today() });
  const request = (bearer: string) => apiFetch(`${BASE}/activitylist-service/activities/search/activities?${params}`, { headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' } });
  let res = await request(await token(cfg));
  if (res.status === 401 && cfg.token) {
    // El token guardado ya no vale (clave renovada o revocada): se pide otro una vez.
    res = await request(await token({ ...cfg, token: undefined, tokenExp: undefined }));
  }
  res = await expectOk(res, 'Garmin');
  const body = await res.json();
  const list: GarminActivity[] = Array.isArray(body) ? body : body.activityList ?? body.activities ?? [];
  const activities: ExternalActivity[] = [];
  let ignored = 0;
  for (const a of list) {
    const when = a.startTimeLocal ?? a.startTimeGMT;
    const mapped = mapGarminType(a.activityType?.typeKey ?? '', a.activityName ?? '');
    if (!mapped || !when || a.activityId == null) {
      ignored++;
      continue;
    }
    activities.push({
      source: 'garmin',
      id: String(a.activityId),
      date: when.slice(0, 10),
      ...mapped,
      title: a.activityName || 'Actividad Garmin',
      distanceM: a.distance ? Math.round(a.distance) : undefined,
      durationS: a.duration ? Math.round(a.duration) : a.movingDuration ? Math.round(a.movingDuration) : undefined
    });
  }
  await saveGarmin({ ...((await getGarmin()) ?? cfg), lastSync: new Date().toISOString() });
  return { activities, ignored };
}

/** Descarga el .fit original de una actividad de Garmin y devuelve su recorrido, si tiene GPS. */
export async function fetchGarminRoute(activityId: string): Promise<string | undefined> {
  const cfg = await getGarmin();
  if (!cfg?.apiKey) throw new SyncError('Falta la clave de Garmin.', 'config');
  const res = await expectOk(await apiFetch(`${BASE}/download-service/files/activity/${encodeURIComponent(activityId)}`, { headers: { Authorization: `Bearer ${await token(cfg)}` } }), 'Garmin');
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { unzipSync } = await import('fflate');
  const { readFit } = await import('./files');
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const fit = isZip ? Object.entries(unzipSync(bytes)).find(([n]) => /\.fit$/i.test(n))?.[1] : bytes;
  if (!fit) return undefined;
  return toRoute((await readFit(fit)).points);
}
