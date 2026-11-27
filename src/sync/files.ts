/**
 * Leer actividades desde archivos: .fit (Garmin y casi todos los relojes), .gpx, .tcx
 * y .zip (lo que da «Exportar original» en Garmin Connect). Todo en el dispositivo.
 */
import { unzipSync } from 'fflate';
import { toISODate } from '../domain/dates';
import { mapFitSport, mapLooseSport, type ExternalActivity } from './activities';

export interface FileParseResult {
  activities: ExternalActivity[];
  ignored: number;
  errors: string[];
}

export async function parseActivityFiles(files: File[]): Promise<FileParseResult> {
  const out: FileParseResult = { activities: [], ignored: 0, errors: [] };
  for (const f of files) {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      await parseBytes(f.name, buf, out);
    } catch (e) {
      out.errors.push(`${f.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`);
    }
  }
  return out;
}

async function parseBytes(name: string, bytes: Uint8Array, out: FileParseResult) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'zip') {
    const entries = unzipSync(bytes);
    for (const [inner, data] of Object.entries(entries)) {
      if (/\.(fit|gpx|tcx)$/i.test(inner)) await parseBytes(inner, data, out);
    }
    return;
  }
  if (ext === 'fit') return parseFit(name, bytes, out);
  const text = new TextDecoder().decode(bytes);
  if (ext === 'gpx') return parseGpx(name, text, out);
  if (ext === 'tcx') return parseTcx(name, text, out);
  throw new Error('formato no soportado (usa .fit, .gpx, .tcx o .zip)');
}

async function parseFit(name: string, bytes: Uint8Array, out: FileParseResult) {
  const { default: FitParser } = await import('fit-file-parser');
  const parser = new FitParser({ force: true, lengthUnit: 'm', mode: 'list' });
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const data = (await parser.parseAsync(ab)) as unknown as { sessions?: FitSession[] };
  const sessions = data.sessions ?? [];
  if (!sessions.length) throw new Error('el archivo no tiene sesiones');
  for (const s of sessions) {
    const start = s.start_time ? new Date(s.start_time) : undefined;
    const mapped = mapFitSport(String(s.sport ?? ''), String(s.sub_sport ?? ''), name);
    if (!mapped || !start) {
      out.ignored++;
      continue;
    }
    out.activities.push({
      source: 'file',
      id: `${start.toISOString()}|${mapped.sport}`,
      date: toISODate(start),
      ...mapped,
      title: titleFromName(name, mapped.sport),
      distanceM: num(s.total_distance),
      durationS: num(s.total_timer_time ?? s.total_elapsed_time)
    });
  }
}

interface FitSession {
  sport?: string;
  sub_sport?: string;
  start_time?: string | Date;
  total_distance?: number;
  total_timer_time?: number;
  total_elapsed_time?: number;
}

function parseGpx(name: string, text: string, out: FileParseResult) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const trk = doc.querySelector('trk');
  const type = trk?.querySelector('type')?.textContent ?? '';
  const title = trk?.querySelector('name')?.textContent ?? doc.querySelector('metadata > name')?.textContent ?? '';
  const pts = Array.from(doc.querySelectorAll('trkpt')).map((p) => ({
    lat: Number(p.getAttribute('lat')),
    lon: Number(p.getAttribute('lon')),
    t: p.querySelector('time')?.textContent
  }));
  const times = pts.map((p) => p.t).filter(Boolean) as string[];
  const startText = doc.querySelector('metadata > time')?.textContent ?? times[0];
  const mapped = mapLooseSport(type, `${title} ${name}`);
  if (!mapped || !startText) {
    out.ignored++;
    return;
  }
  let dist = 0;
  for (let i = 1; i < pts.length; i++) dist += haversine(pts[i - 1], pts[i]);
  const start = new Date(startText);
  const end = times.length ? new Date(times[times.length - 1]) : start;
  out.activities.push({
    source: 'file',
    id: `${start.toISOString()}|${mapped.sport}`,
    date: toISODate(start),
    ...mapped,
    title: title || titleFromName(name, mapped.sport),
    distanceM: dist ? Math.round(dist) : undefined,
    durationS: Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)) || undefined
  });
}

function parseTcx(name: string, text: string, out: FileParseResult) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  for (const act of Array.from(doc.getElementsByTagName('Activity'))) {
    const sport = act.getAttribute('Sport') ?? '';
    const idText = act.getElementsByTagName('Id')[0]?.textContent ?? '';
    const mapped = mapLooseSport(sport, name);
    if (!mapped || !idText) {
      out.ignored++;
      continue;
    }
    let dist = 0;
    let time = 0;
    for (const lap of Array.from(act.getElementsByTagName('Lap'))) {
      time += Number(lap.getElementsByTagName('TotalTimeSeconds')[0]?.textContent ?? 0);
      dist += Number(lap.getElementsByTagName('DistanceMeters')[0]?.textContent ?? 0);
    }
    const start = new Date(idText);
    out.activities.push({
      source: 'file',
      id: `${start.toISOString()}|${mapped.sport}`,
      date: toISODate(start),
      ...mapped,
      title: titleFromName(name, mapped.sport),
      distanceM: dist ? Math.round(dist) : undefined,
      durationS: time ? Math.round(time) : undefined
    });
  }
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : undefined);

function titleFromName(file: string, sport: string): string {
  const base = file.replace(/\.(fit|gpx|tcx)$/i, '').replace(/[_-]+/g, ' ').trim();
  if (base && !/^\d+$/.test(base) && !/^activity \d+/i.test(base)) return base;
  return { run: 'Carrera', swim: 'Natación', bike: 'Bici', gym: 'Gimnasio' }[sport] ?? 'Actividad';
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
