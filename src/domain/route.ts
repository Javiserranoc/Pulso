/**
 * Recorridos GPS. Se guardan como «encoded polyline» (el formato de Google que usa Strava),
 * simplificados para que ocupen poco: unos cientos de puntos bastan para dibujarlos.
 */
export type LatLng = [number, number];

export function encodePolyline(points: LatLng[], precision = 5): string {
  const f = 10 ** precision;
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const [lat, lng] of points) {
    const la = Math.round(lat * f);
    const ln = Math.round(lng * f);
    out += enc(la - lastLat) + enc(ln - lastLng);
    lastLat = la;
    lastLng = ln;
  }
  return out;
}

export function decodePolyline(str: string, precision = 5): LatLng[] {
  const f = 10 ** precision;
  const pts: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    pts.push([lat / f, lng / f]);
  }
  return pts;
}

/** Douglas-Peucker (tolerancia en grados ≈ metros/111000) y como mucho `max` puntos. */
export function simplify(points: LatLng[], tolerance = 0.00004, max = 400): LatLng[] {
  const pts = points.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && !(a === 0 && b === 0));
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-18;
    for (let k = s + 1; k < e; k++) {
      const [px, py] = pts[k];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const qx = ax + t * dx - px;
      const qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > maxD) {
        maxD = d;
        idx = k;
      }
    }
    if (idx > 0 && maxD > t2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  let out = pts.filter((_, k) => keep[k]);
  if (out.length > max) {
    const step = out.length / max;
    out = Array.from({ length: max }, (_, k) => out[Math.floor(k * step)]).concat([out[out.length - 1]]);
  }
  return out;
}

/** Recorrido listo para guardar, o undefined si no hay puntos suficientes. */
export function toRoute(points: LatLng[]): string | undefined {
  const s = simplify(points);
  return s.length >= 2 ? encodePolyline(s) : undefined;
}

/** Proyección simple para dibujar el recorrido en un SVG (sin mapa). */
export function routeToSvgPath(route: string, w = 100, h = 60, pad = 6): string {
  const pts = decodePolyline(route);
  if (pts.length < 2) return '';
  const k = Math.cos((pts.reduce((a, p) => a + p[0], 0) / pts.length) * (Math.PI / 180));
  const xs = pts.map((p) => p[1] * k);
  const ys = pts.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((w - 2 * pad) / (maxX - minX || 1e-9), (h - 2 * pad) / (maxY - minY || 1e-9));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  return xs.map((x, i) => `${i ? 'L' : 'M'}${(ox + (x - minX) * scale).toFixed(1)} ${(oy + (ys[i] - minY) * scale).toFixed(1)}`).join('');
}
