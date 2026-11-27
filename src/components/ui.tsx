import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconBarbell, IconBike, IconMoon, IconRipple, IconRun, IconSwimming, IconTrophy } from '@tabler/icons-react';
import type { Sport, Subtype } from '../domain/types';

/** Rodillo: Tabler no lo tiene; es su bici reducida sobre el soporte. */
function IconTrainer({ size = 24, stroke = 1.8 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(1.8 0) scale(0.85)">
        {['M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M12 19v-4l-3 -3l5 -4l2 3h3', 'M13 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'].map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <path d="M3.5 21.5h17M17.9 15.3l-2.4 6.2M17.9 15.3l2.4 6.2M4.6 21.5l1.4 -3.6l1.4 3.6" />
    </svg>
  );
}

export function SportIcon({ sport, subtype, size = 22 }: { sport: Sport; subtype?: Subtype; size?: number }) {
  const p = { size, stroke: 1.8 };
  if (sport === 'swim') return subtype === 'open_water' ? <IconRipple {...p} /> : <IconSwimming {...p} />;
  if (sport === 'bike') return subtype === 'trainer' ? <IconTrainer {...p} /> : <IconBike {...p} />;
  if (sport === 'run') return <IconRun {...p} />;
  if (sport === 'gym') return <IconBarbell {...p} />;
  if (sport === 'race') return <IconTrophy {...p} />;
  return <IconMoon {...p} />;
}

export function SportTile({ sport, subtype, size = 42, on = false }: { sport: Sport; subtype?: Subtype; size?: number; on?: boolean }) {
  return (
    <span className={`tile${on ? ' tile--on' : ''}`} style={{ width: size, height: size, borderRadius: size * 0.31 }}>
      <SportIcon sport={sport} subtype={subtype} size={Math.round(size * 0.52)} />
    </span>
  );
}

export function Ring({ ratio, size = 100, children }: { ratio: number; size?: number; children?: ReactNode }) {
  const r = size * 0.43;
  const c = 2 * Math.PI * r;
  const w = size * 0.07;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={w} />
        {ratio > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--blue)" strokeWidth={w} strokeLinecap="round" strokeDasharray={`${Math.min(1, ratio) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .4s ease' }} />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

export interface Bar {
  label: string;
  a: number;
  b: number;
  current?: boolean;
}

/** Barras apiladas: «a» en azul y «b» (segunda subcategoría) en azul claro. */
export function BarChart({ data, height = 96, gap = 10 }: { data: Bar[]; height?: number; gap?: number }) {
  const max = Math.max(1, ...data.map((d) => d.a + d.b));
  const cols = { display: 'grid', gridTemplateColumns: `repeat(${data.length}, minmax(0,1fr))`, gap } as const;
  return (
    <div>
      <div style={{ ...cols, height, alignItems: 'end' }}>
        {data.map((d, i) => {
          const empty = d.a + d.b === 0;
          return (
            <div key={i} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: d.a && d.b ? 2 : 0 }} title={`${d.label}`}>
              {d.b > 0 && <div style={{ height: `${(d.b / max) * 100}%`, borderRadius: d.a ? '6px 6px 2px 2px' : 6, background: '#9CC2FF' }} />}
              {empty ? (
                <div style={{ height: 3, borderRadius: 2, background: 'var(--track)' }} />
              ) : (
                d.a > 0 && <div style={{ height: `${(d.a / max) * 100}%`, borderRadius: d.b ? '2px 2px 6px 6px' : 6, background: d.current || d.b ? 'var(--blue)' : '#2A2E35' }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ ...cols, marginTop: 6, fontSize: 11, textAlign: 'center' }}>
        {data.map((d, i) => (
          <span key={i} style={{ color: d.current ? 'var(--text)' : 'var(--muted)', fontWeight: d.current ? 600 : 400 }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Carrusel que se pasa deslizando, con puntos. */
export function Carousel({ children, labels }: { children: ReactNode[]; labels: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 10 : el.clientWidth;
    setI(Math.round(el.scrollLeft / w));
  };
  const go = (k: number) => {
    const el = ref.current;
    const child = el?.children[k] as HTMLElement | undefined;
    if (el && child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  };
  return (
    <div>
      <div ref={ref} onScroll={onScroll} style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', margin: '0 -20px', padding: '0 20px', scrollPaddingLeft: 20 }}>
        {children.map((c, k) => (
          <div key={k} style={{ flex: '0 0 calc(100% - 30px)', scrollSnapAlign: 'start' }}>
            {c}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 6 }}>
        {labels.map((l, k) => (
          <button key={l} aria-label={l} aria-current={k === i} onClick={() => go(k)} style={{ width: 28, height: 28, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <i style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, background: k === i ? 'var(--blue)' : '#3A3F48', transition: 'width .2s' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="inner">
          <div className="grabber" />
          {children}
        </div>
      </div>
    </>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

let toastTimer: number | undefined;
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => {
    setMsg(m);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setMsg(null), 2200);
  };
  const node = msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
  return { show, node };
}
