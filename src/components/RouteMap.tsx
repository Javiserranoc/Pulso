import { useEffect, useRef, useState } from 'react';
import { decodePolyline, routeToSvgPath } from '../domain/route';

/**
 * Mapa del recorrido: Leaflet (se carga solo al abrir una sesión con recorrido) sobre el mapa base
 * oscuro de CARTO, con la ruta en el azul de Pulso. Sin conexión se ve la ruta sobre fondo oscuro.
 */
export function RouteMap({ route, height = 230 }: { route: string; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import('leaflet').Map | undefined;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        if (cancelled || !el.current) return;
        const pts = decodePolyline(route);
        map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
        map.attributionControl.setPrefix('Leaflet');
        // Teselas estándar de OpenStreetMap (sin clave); se oscurecen con CSS (.route-tiles)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          className: 'route-tiles',
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        L.polyline(pts, { color: '#5B9BFF', weight: 9, opacity: 0.22 }).addTo(map);
        const line = L.polyline(pts, { color: '#2F7BFF', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
        L.circleMarker(pts[0], { radius: 6, color: '#0A0B0D', weight: 2, fillColor: '#F2F4F7', fillOpacity: 1 }).addTo(map);
        L.circleMarker(pts[pts.length - 1], { radius: 6, color: '#0A0B0D', weight: 2, fillColor: '#2F7BFF', fillOpacity: 1 }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [24, 24] });
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [route]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', height, position: 'relative' }}>
      {failed ? <MiniRoute route={route} width="100%" height={height} /> : <div ref={el} style={{ position: 'absolute', inset: 0, background: '#0E1014' }} aria-label="Mapa del recorrido" role="img" />}
    </div>
  );
}

/** Miniatura del recorrido en SVG (sin mapa ni red). */
export function MiniRoute({ route, width = 42, height = 42 }: { route: string; width?: number | string; height?: number }) {
  const d = routeToSvgPath(route, 100, 100, 12);
  if (!d) return null;
  return (
    <svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Recorrido" style={{ display: 'block' }}>
      <path d={d} fill="none" stroke="#5B9BFF" strokeOpacity="0.25" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#2F7BFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
