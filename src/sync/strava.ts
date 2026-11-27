/**
 * Strava · API v3 con OAuth, para uso personal: el usuario crea su propia «aplicación» en
 * strava.com/settings/api (Client ID y Client Secret) y los guarda solo en este dispositivo.
 * Desde junio de 2026 Strava exige suscripción para usar su API en el nivel estándar.
 */
import { getSetting, setSetting } from '../db/db';
import { mapStravaType, type ExternalActivity } from './activities';
import { apiFetch, expectOk, SyncError } from './net';

const AUTH = 'https://www.strava.com/oauth/authorize';
const TOKEN = 'https://www.strava.com/oauth/token';
// Strava cambia la URL base a api-v3.strava.com a partir del 4 de enero de 2027.
const API = () => (new Date() >= new Date('2027-01-04') ? 'https://api-v3.strava.com' : 'https://www.strava.com/api/v3');
export const STRAVA_STATE = 'pulso-strava';

export interface StravaConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // s
  athlete?: string;
  lastSync?: string;
}

export const getStrava = () => getSetting<StravaConfig | null>('strava', null);
export const saveStrava = (c: StravaConfig | null) => setSetting('strava', c);

/** Dirección a la que vuelve Strava: la propia app, sin la parte de la ruta interna (#/…). */
export function redirectUri(): string {
  return `${location.origin}${location.pathname}`;
}

export function authorizeUrl(clientId: string): string {
  const p = new URLSearchParams({ client_id: clientId.trim(), redirect_uri: redirectUri(), response_type: 'code', approval_prompt: 'auto', scope: 'activity:read_all', state: STRAVA_STATE });
  return `${AUTH}?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await expectOk(
    await apiFetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() }),
    'Strava'
  );
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_at: number; athlete?: { firstname?: string; lastname?: string } }>;
}

/** Cambia el código de la vuelta de Strava por los tokens y los guarda. */
export async function exchangeCode(code: string): Promise<StravaConfig> {
  const cfg = await getStrava();
  if (!cfg?.clientId || !cfg.clientSecret) throw new SyncError('Primero guarda el Client ID y el Client Secret de Strava.', 'config');
  const t = await tokenRequest({ client_id: cfg.clientId.trim(), client_secret: cfg.clientSecret.trim(), code: code.trim(), grant_type: 'authorization_code' });
  const next: StravaConfig = { ...cfg, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, athlete: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || cfg.athlete };
  await saveStrava(next);
  return next;
}

async function access(cfg: StravaConfig): Promise<string> {
  if (!cfg.refreshToken) throw new SyncError('Strava no está conectado.', 'config');
  if (cfg.accessToken && cfg.expiresAt && cfg.expiresAt * 1000 - Date.now() > 5 * 60_000) return cfg.accessToken;
  const t = await tokenRequest({ client_id: cfg.clientId.trim(), client_secret: cfg.clientSecret.trim(), refresh_token: cfg.refreshToken, grant_type: 'refresh_token' });
  await saveStrava({ ...cfg, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at });
  return t.access_token;
}

interface StravaActivity {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date_local?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  trainer?: boolean;
  map?: { summary_polyline?: string };
}

export async function fetchStrava(days = 30): Promise<{ activities: ExternalActivity[]; ignored: number }> {
  const cfg = await getStrava();
  if (!cfg) throw new SyncError('Strava no está configurado.', 'config');
  const bearer = await access(cfg);
  const after = Math.floor((Date.now() - days * 864e5) / 1000);
  const res = await expectOk(await apiFetch(`${API()}/athlete/activities?after=${after}&per_page=100`, { headers: { Authorization: `Bearer ${bearer}` } }), 'Strava');
  const list = (await res.json()) as StravaActivity[];
  const activities: ExternalActivity[] = [];
  let ignored = 0;
  for (const a of list) {
    const mapped = mapStravaType(a.sport_type ?? a.type ?? '', !!a.trainer, a.name ?? '');
    if (!mapped || !a.start_date_local) {
      ignored++;
      continue;
    }
    activities.push({
      source: 'strava',
      id: String(a.id),
      date: a.start_date_local.slice(0, 10),
      ...mapped,
      title: a.name || 'Actividad Strava',
      distanceM: a.distance ? Math.round(a.distance) : undefined,
      durationS: a.moving_time ?? a.elapsed_time,
      route: a.map?.summary_polyline || undefined
    });
  }
  await saveStrava({ ...((await getStrava()) ?? cfg), lastSync: new Date().toISOString() });
  return { activities, ignored };
}
