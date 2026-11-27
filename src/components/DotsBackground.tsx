import { useEffect, useRef } from 'react';

/**
 * Fondo de puntos en movimiento, pensado para no ralentizar:
 * - un único <canvas> fijo detrás de todo (no toca el DOM ni provoca re-renders de React);
 * - ~30 fps, resolución limitada a 2× y número de puntos según el tamaño de pantalla;
 * - se pausa cuando la app está en segundo plano;
 * - con «reducir movimiento» del sistema se dibuja una vez y queda quieto.
 */
export default function DotsBackground({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !enabled) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const LINK = 110; // distancia máxima para unir dos puntos (px CSS)
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    type P = { x: number; y: number; vx: number; vy: number; r: number; blue: boolean };
    let pts: P[] = [];

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.max(24, Math.min(70, Math.round((w * h) / 14000)));
      while (pts.length < target) {
        pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, r: 0.8 + Math.random() * 1.1, blue: Math.random() < 0.28 });
      }
      pts = pts.slice(0, target);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(91,155,255,${0.1 * (1 - Math.sqrt(d2) / LINK)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = p.blue ? 'rgba(91,155,255,0.55)' : 'rgba(201,206,214,0.28)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (t - last < 33) return; // ~30 fps
      const dt = Math.min(3, (t - last) / 16.7);
      last = t;
      for (const p of pts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -10) p.x = w + 10;
        else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        else if (p.y > h + 10) p.y = -10;
      }
      draw();
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { resize(); draw(); }, 150);
    };

    resize();
    draw();
    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 0, pointerEvents: 'none' }} />;
}
