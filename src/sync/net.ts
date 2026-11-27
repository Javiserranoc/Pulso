/**
 * Peticiones a Garmin y Strava. Primero se intenta directamente desde el navegador;
 * si el servicio no lo permite (CORS) y hay un intermediario configurado en Ajustes,
 * se repite a través de él. Ver proxy/README.md.
 */
import { getSetting } from '../db/db';

export class SyncError extends Error {
  constructor(message: string, readonly kind: 'cors' | 'auth' | 'http' | 'config' = 'http') {
    super(message);
  }
}

export async function proxyUrl(): Promise<string> {
  return ((await getSetting<string>('proxyUrl', '')) || '').replace(/\/+$/, '');
}

/** fetch con reintento por el intermediario. `target` es la URL real del servicio. */
export async function apiFetch(target: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(target, init);
  } catch {
    const proxy = await proxyUrl();
    if (!proxy) {
      throw new SyncError('El servicio no permite conectar directamente desde el navegador. Configura el intermediario en Ajustes → Conexiones → Avanzado.', 'cors');
    }
    try {
      return await fetch(`${proxy}/?url=${encodeURIComponent(target)}`, init);
    } catch {
      throw new SyncError('No se pudo conectar ni directamente ni a través del intermediario. Revisa la conexión y la URL del intermediario.', 'cors');
    }
  }
}

export async function expectOk(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  if (res.status === 401 || res.status === 403) throw new SyncError(`${what}: la clave o el permiso no son válidos (${res.status}).`, 'auth');
  if (res.status === 429) throw new SyncError(`${what}: demasiadas peticiones; prueba dentro de unos minutos.`);
  throw new SyncError(`${what}: el servicio respondió ${res.status}.`);
}
