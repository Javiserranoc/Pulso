/**
 * Fondo «Cinta de puntos»: cintas de luz resueltas en una trama de puntos (WebGL).
 * Adaptado de RibbonFieldBackground de ThreeUI Community — https://github.com/MengTo/threeui
 * Copyright (c) 2026 Meng To · Licencia MIT (ver THIRD_PARTY_NOTICES.md).
 * Cambios: paleta azul de Pulso, encuadre vertical, intensidad reducida, ~30 fps,
 * pausa en segundo plano y fotograma fijo con «Reducir movimiento».
 */
import { useEffect, useRef } from 'react';

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform vec2 pointer;
uniform float ratio;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float ribbon(vec2 uv, float offset, float width, float phase) {
  float y = 0.55 + 0.20 * sin((uv.x * 2.15) + phase) + 0.045 * sin((uv.x * 7.0) - phase * 0.7);
  float d = abs(uv.y - y - offset);
  return exp(-(d * d) / width);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float portrait = step(resolution.x, resolution.y);
  float t = time * 0.22;
  float drift = (pointer.x - 0.5) * 0.06;

  // En vertical las cintas ocupan todo el ancho; en horizontal se desvanecen hacia la izquierda.
  float sideFade = mix(smoothstep(0.28, 0.72, uv.x), 0.35 + 0.65 * smoothstep(0.0, 0.9, uv.x), portrait);
  float centerDark = 1.0 - smoothstep(0.0, 0.88, distance(uv, vec2(0.18, 0.48)));

  float r1 = ribbon(vec2(uv.x + drift, uv.y), 0.03, 0.0065, t + 0.9);
  float r2 = ribbon(vec2(uv.x - drift * 0.7, uv.y), -0.23, 0.0085, t + 3.25);
  float r3 = ribbon(vec2(uv.x + drift * 0.4, uv.y), 0.25, 0.014, t + 1.85);
  float glow = r1 * 1.14 + r2 * 1.05 + r3 * 0.48;

  // Paleta de Pulso: azul principal, azul claro, hielo y un azul profundo.
  vec3 blue = vec3(0.184, 0.482, 1.0);
  vec3 light = vec3(0.357, 0.608, 1.0);
  vec3 ice = vec3(0.612, 0.761, 1.0);
  vec3 deep = vec3(0.12, 0.31, 0.84);

  vec3 col = vec3(0.0);
  col += light * r1 * 0.92;
  col += ice * r1 * 0.35;
  col += deep * r3 * 0.55;
  col += blue * r2 * 0.75;

  float bloom = exp(-pow(distance(uv, vec2(0.76, 0.40 + 0.035 * sin(t))), 2.0) / 0.050);
  bloom += exp(-pow(distance(uv, vec2(0.71, 0.75 + 0.025 * cos(t))), 2.0) / 0.030);
  col += ice * bloom * 0.30;

  // Trama de puntos de 7 px CSS, independiente de la densidad de la pantalla.
  vec2 cell = gl_FragCoord.xy / (7.0 * ratio);
  vec2 grid = fract(cell) - 0.5;
  float dotShape = smoothstep(0.29, 0.11, length(grid));
  float noise = hash(floor(cell));
  float scan = 0.72 + 0.28 * sin((uv.x + uv.y) * 38.0 + time * 1.3);
  float dots = dotShape * (0.48 + 0.52 * noise) * scan;

  float alpha = clamp((glow * 1.55 + bloom * 0.50) * dots * sideFade, 0.0, 1.0);
  alpha *= 1.0 - centerDark * 0.56;
  alpha *= 0.62; // más tenue que el original: es un fondo, no protagonista

  vec3 base = vec3(0.039, 0.043, 0.051); // #0A0B0D
  gl_FragColor = vec4(mix(base, col, clamp(alpha * 1.55, 0.0, 1.0)), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader');
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export default function RibbonBackground({ onUnsupported }: { onUnsupported?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) {
      onUnsupported?.();
      return;
    }
    let program: WebGLProgram | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    try {
      vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
      fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
      program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
    } catch {
      onUnsupported?.();
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(program, 'resolution');
    const uTime = gl.getUniformLocation(program, 'time');
    const uPointer = gl.getUniformLocation(program, 'pointer');
    const uRatio = gl.getUniformLocation(program, 'ratio');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const started = performance.now();
    let mx = 0.72, my = 0.42, tx = 0.72, ty = 0.42;
    let raf = 0;
    let last = 0;

    const resize = () => {
      const r = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * r));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * r));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uRatio, r);
    };
    const draw = (now: number) => {
      mx += (tx - mx) * 0.035;
      my += (ty - my) * 0.035;
      gl.uniform1f(uTime, (now - started) * 0.001);
      gl.uniform2f(uPointer, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30 fps
      last = now;
      draw(now);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (reduced) {
        draw(started + 4000);
        return;
      }
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    const onPointer = (e: PointerEvent) => {
      tx = 0.72 + (e.clientX / Math.max(1, window.innerWidth) - 0.72) * 0.6;
      ty = 0.42 + (1 - e.clientY / Math.max(1, window.innerHeight) - 0.42) * 0.6;
    };
    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => { resize(); draw(performance.now()); }, 150);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());

    resize();
    draw(performance.now());
    start();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
    };
  }, [onUnsupported]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 0, pointerEvents: 'none' }} />;
}
