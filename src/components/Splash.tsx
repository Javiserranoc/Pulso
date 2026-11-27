import { useEffect, useState } from 'react';

/**
 * Animación de arranque «Latido»: se dibuja la línea de pulso, el punto de «hoy» late y aparece «Pulso».
 * Solo en el arranque en frío (una vez por carga), ~1,3 s, se salta con un toque
 * y no se muestra si el sistema pide reducir movimiento.
 */
// Se decide una sola vez al cargar el módulo (no depende de renders ni del StrictMode de desarrollo).
const SHOW_ON_LOAD = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Splash() {
  const [phase, setPhase] = useState<'on' | 'leaving' | 'off'>(SHOW_ON_LOAD ? 'on' : 'off');

  useEffect(() => {
    if (phase !== 'on') return;
    const t1 = window.setTimeout(() => setPhase('leaving'), 1300);
    return () => window.clearTimeout(t1);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t2 = window.setTimeout(() => setPhase('off'), 320);
    return () => window.clearTimeout(t2);
  }, [phase]);

  if (phase === 'off') return null;
  return (
    <div className={`splash${phase === 'leaving' ? ' splash--out' : ''}`} onClick={() => setPhase('leaving')} role="presentation">
      <svg width="170" height="170" viewBox="0 0 100 100" aria-hidden="true" style={{ overflow: 'visible' }}>
        <path className="splash-line" d="M14 52H33L40 36L50 68L58 30L65 52H80" fill="none" stroke="#2F7BFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="splash-wave" cx="84" cy="52" r="5" fill="none" stroke="#5B9BFF" strokeWidth="1.5" />
        <circle className="splash-dot" cx="84" cy="52" r="5" fill="#F2F4F7" />
      </svg>
      <span className="splash-word">Pulso</span>
    </div>
  );
}
