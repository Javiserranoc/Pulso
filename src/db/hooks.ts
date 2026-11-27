import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { toISODate } from '../domain/dates';
import type { Session, Template } from '../domain/types';

/** Sesiones entre dos fechas (incluidas), actualizadas en vivo. */
export function useSessions(from: string, to: string): Session[] | undefined {
  return useLiveQuery(() => db.sessions.where('date').between(from, to, true, true).toArray(), [from, to]);
}

export function useAllSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.toArray(), []);
}

export function useSession(id?: number): Session | undefined | null {
  return useLiveQuery(async () => (id == null ? null : (await db.sessions.get(id)) ?? null), [id]);
}

export function useTemplates(): Template[] | undefined {
  return useLiveQuery(() => db.templates.toArray(), []);
}

export function useSetting<T>(key: string, fallback: T): T {
  const v = useLiveQuery(async () => (await db.settings.get(key))?.value as T | undefined, [key]);
  return v ?? fallback;
}

/** Sesiones recientes únicas (deporte + título), las más nuevas primero. */
export function useRecents(limit = 8): Session[] {
  return (
    useLiveQuery(async () => {
      // Primero lo ya entrenado (hasta hoy) y después lo planificado a futuro.
      const t = toISODate(new Date());
      const all = (await db.sessions.orderBy('date').reverse().toArray()).sort((a, b) => Number(a.date > t) - Number(b.date > t));
      const seen = new Set<string>();
      const out: Session[] = [];
      for (const s of all) {
        if (s.sport === 'rest') continue;
        const k = `${s.sport}|${s.subtype ?? ''}|${s.title}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
        if (out.length >= limit) break;
      }
      return out;
    }, [limit]) ?? []
  );
}
