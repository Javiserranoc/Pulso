import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline, simplify, toRoute, routeToSvgPath } from './route';

describe('route', () => {
  it('codifica y decodifica un polyline (ejemplo de Google)', () => {
    const pts: [number, number][] = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]];
    const enc = encodePolyline(pts);
    expect(enc).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    const dec = decodePolyline(enc);
    dec.forEach((p, i) => { expect(p[0]).toBeCloseTo(pts[i][0], 5); expect(p[1]).toBeCloseTo(pts[i][1], 5); });
  });
  it('simplifica a como mucho 400 puntos', () => {
    const pts: [number, number][] = Array.from({ length: 5000 }, (_, i) => [43.3 + Math.sin(i / 50) * 0.01, -2.9 + i * 0.00001]);
    expect(simplify(pts).length).toBeLessThanOrEqual(400);
  });
  it('toRoute ignora rutas sin puntos y genera un path SVG', () => {
    expect(toRoute([])).toBeUndefined();
    const r = toRoute([[43.3, -2.9], [43.31, -2.91], [43.32, -2.9]]);
    expect(r).toBeTruthy();
    expect(routeToSvgPath(r!, 40, 40, 4)).toMatch(/^M/);
  });
});
