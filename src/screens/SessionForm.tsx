import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IconArrowLeft, IconCheck, IconCopy, IconTemplate, IconTrash } from '@tabler/icons-react';
import { addSession, deleteSession, duplicateSession, saveTemplate, updateSession } from '../db/db';
import { useRecents, useSession, useTemplates } from '../db/hooks';
import { addDays, DAY_LETTERS, formatShort, parseISODate, today, weekDays } from '../domain/dates';
import { fmtDistanceValue, fmtDuration, fmtNumber, fmtPace, parseDistance, parseDuration } from '../domain/format';
import { GYM_TAGS, SPORT_ORDER, SPORTS, ZONES } from '../domain/sports';
import type { Sport, Status, Subtype } from '../domain/types';
import { Segmented, SportTile, useToast } from '../components/ui';

interface Draft {
  date: string;
  sport: Sport;
  subtype?: Subtype;
  title: string;
  notes: string;
  dist: string;
  time: string;
  zone?: number;
  gymTags: string[];
  status: Status;
}

const defaultStatus = (date: string): Status => (date <= today() ? 'done' : 'planned');

export default function SessionForm() {
  const nav = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [params] = useSearchParams();
  const editId = id ? Number(id) : undefined;
  const existing = useSession(editId);
  const templates = useTemplates() ?? [];
  const recents = useRecents(12);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const initialDate = params.get('fecha') ?? today();
  const initialSport = (params.get('deporte') as Sport) ?? 'run';
  const [d, setD] = useState<Draft>(() => ({
    date: initialDate,
    sport: initialSport,
    subtype: SPORTS[initialSport].subtypes[0]?.id,
    title: '',
    notes: '',
    dist: '',
    time: '',
    gymTags: [],
    status: defaultStatus(initialDate)
  }));
  const loaded = useRef(false);
  useEffect(() => {
    if (existing && !loaded.current) {
      loaded.current = true;
      setD({
        date: existing.date,
        sport: existing.sport,
        subtype: existing.subtype,
        title: existing.title,
        notes: existing.notes,
        dist: fmtDistanceValue(existing.sport, existing.distanceM),
        time: fmtDuration(existing.durationS),
        zone: existing.zone,
        gymTags: existing.gymTags ?? [],
        status: existing.status
      });
    }
  }, [existing]);

  const cfg = SPORTS[d.sport];
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  // Al cambiar de deporte se vacía lo que dependía del anterior (en edición se conserva el texto).
  const setSport = (sport: Sport) => {
    if (sport === d.sport) return;
    set({ sport, subtype: SPORTS[sport].subtypes[0]?.id, dist: '', zone: undefined, gymTags: [], ...(editId ? {} : { title: '', notes: '' }) });
  };

  // Plantillas y recientes del deporte elegido, sin repetir.
  const shortcuts = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; title: string; subtype?: Subtype; notes: string; distanceM?: number; gymTags?: string[] }[] = [];
    for (const s of [...recents, ...templates]) {
      if (s.sport !== d.sport) continue;
      const k = `${s.subtype ?? ''}|${s.title}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ key: k, title: s.title, subtype: s.subtype, notes: s.notes, distanceM: s.distanceM, gymTags: s.gymTags });
    }
    return out.slice(0, 8);
  }, [recents, templates, d.sport]);

  const insert = (text: string) => {
    const el = notesRef.current;
    const pos = el ? el.selectionStart : d.notes.length;
    const before = d.notes.slice(0, pos);
    const after = d.notes.slice(pos);
    const sep = before && !/[\s(]$/.test(before) ? ' ' : '';
    const piece = text === '×' ? '×' : `${text} `;
    const next = (text === '×' ? before.replace(/\s+$/, '') : before + sep) + piece + after;
    set({ notes: next });
    requestAnimationFrame(() => {
      if (!el) return;
      const p = next.length - after.length;
      el.focus();
      el.setSelectionRange(p, p);
    });
  };

  const distanceM = parseDistance(d.sport, d.dist);
  const durationS = parseDuration(d.time);
  const pace = fmtPace(d.sport, distanceM, durationS);
  const distInvalid = !!d.dist.trim() && distanceM == null;
  const timeInvalid = !!d.time.trim() && durationS == null;

  const build = () => ({
    date: d.date,
    sport: d.sport,
    subtype: cfg.subtypes.length ? d.subtype : undefined,
    title: d.title.trim() || (d.sport === 'gym' && d.gymTags.length ? d.gymTags.join(' + ') : d.sport === 'rest' ? 'Descanso' : distanceM ? `${fmtNumber(distanceM / (cfg.unit === 'm' ? 1 : 1000), cfg.unit === 'm' ? 0 : 1)} ${cfg.unit}` : cfg.name),
    notes: d.notes.trim(),
    distanceM: cfg.unit ? distanceM : undefined,
    durationS: d.sport === 'rest' ? undefined : durationS,
    zone: d.sport === 'rest' || d.sport === 'gym' ? undefined : d.zone,
    gymTags: d.sport === 'gym' ? d.gymTags : undefined,
    status: d.sport === 'rest' ? ('done' as Status) : d.status
  });

  const save = async () => {
    if (distInvalid || timeInvalid) return;
    if (editId) await updateSession(editId, build());
    else await addSession(build());
    nav(-1);
  };

  const week = weekDays(d.date);

  if (editId && existing === null) {
    return (
      <main className="screen">
        <p className="muted">Esta sesión ya no existe.</p>
        <button className="btn-ghost" onClick={() => nav('/')}>Volver al inicio</button>
      </main>
    );
  }

  return (
    <main className="screen screen--form">
      <header className="between">
        <button className="btn-round" aria-label="Volver" onClick={() => nav(-1)}><IconArrowLeft size={20} /></button>
        <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{editId ? 'Editar sesión' : 'Registrar sesión'}</span>
        <label className="btn-pill" style={{ position: 'relative', overflow: 'hidden' }}>
          {formatShort(d.date)}
          <input type="date" aria-label="Fecha" value={d.date} onChange={(e) => e.target.value && set({ date: e.target.value, status: editId ? d.status : defaultStatus(e.target.value) })} style={{ position: 'absolute', inset: 0, opacity: 0 }} />
        </label>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, marginTop: 16 }}>
        {week.map((w, i) => (
          <button key={w} className="chip" aria-pressed={w === d.date} aria-label={formatShort(w)} onClick={() => set({ date: w, status: editId ? d.status : defaultStatus(w) })} style={{ justifyContent: 'center', padding: 0, height: 40, borderRadius: 12, flexDirection: 'column', gap: 0, fontSize: 11 }}>
            {DAY_LETTERS[i]}
            <span className="num" style={{ fontSize: 13 }}>{parseISODate(w).getDate()}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 6, marginTop: 16 }}>
        {SPORT_ORDER.map((sp) => (
          <button key={sp} onClick={() => setSport(sp)} aria-pressed={sp === d.sport} style={{ border: 'none', background: 'none', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, fontSize: 11, color: sp === d.sport ? 'var(--text)' : 'var(--muted)', fontWeight: sp === d.sport ? 600 : 500 }}>
            <SportTile sport={sp} size={48} on={sp === d.sport} />
            {SPORTS[sp].short}
          </button>
        ))}
      </div>

      {cfg.subtypes.length > 0 && (
        <div className="mt-16">
          <Segmented<Subtype> value={d.subtype ?? cfg.subtypes[0].id} onChange={(subtype) => set({ subtype })} options={cfg.subtypes.map((s) => ({ id: s.id, label: s.name }))} />
        </div>
      )}

      {d.sport !== 'rest' && (
        <>
          {shortcuts.length > 0 && (
            <div className="mt-16">
              <span className="label">Plantillas y recientes</span>
              <div className="chips mt-8">
                {shortcuts.map((s) => (
                  <button key={s.key} className="chip" aria-pressed={d.title === s.title} onClick={() => set({ title: s.title, notes: s.notes, subtype: s.subtype ?? d.subtype, dist: fmtDistanceValue(d.sport, s.distanceM), gymTags: s.gymTags ?? d.gymTags })}>
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="stack mt-16" style={{ gap: 8 }}>
            <span className="label">Nombre de la sesión</span>
            <input className="field-input" value={d.title} placeholder={d.sport === 'race' ? 'Behobia, media maratón…' : d.sport === 'gym' ? 'Empuje + Core…' : 'Series MTT, rodaje Z2…'} onChange={(e) => set({ title: e.target.value })} />
          </label>

          {cfg.unit && (
            <div className="card card--focus mt-12" style={{ padding: '12px 16px 14px', borderColor: distInvalid ? '#ff8a80' : undefined }}>
              <div className="between" style={{ alignItems: 'baseline' }}>
                <label htmlFor="dist" className="label">Distancia</label>
                <span className="row" style={{ alignItems: 'baseline', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
                  <input id="dist" className="big-input" inputMode="decimal" placeholder="0" value={d.dist} onChange={(e) => set({ dist: e.target.value })} style={{ maxWidth: 200 }} />
                  <span className="muted" style={{ fontSize: 16 }}>{cfg.unit}</span>
                </span>
              </div>
              <div className="chips mt-8">
                {cfg.presets.map((p) => {
                  const v = fmtNumber(p, cfg.unit === 'm' ? 0 : 1);
                  return <button key={p} className="chip chip--soft" aria-pressed={d.dist === v} onClick={() => set({ dist: v })}>{v}</button>;
                })}
              </div>
            </div>
          )}

          {d.sport === 'gym' && (
            <div className="card mt-12">
              <span className="label">Tipo de sesión</span>
              <div className="chips chips--wrap mt-8">
                {GYM_TAGS.map((g) => (
                  <button key={g} className="chip" aria-pressed={d.gymTags.includes(g)} onClick={() => set({ gymTags: d.gymTags.includes(g) ? d.gymTags.filter((x) => x !== g) : [...d.gymTags, g] })}>{g}</button>
                ))}
              </div>
            </div>
          )}

          <div className="row mt-12" style={{ alignItems: 'stretch' }}>
            <label className="card card--tight stack" style={{ width: 110, flex: 'none', gap: 2, borderColor: timeInvalid ? '#ff8a80' : undefined }}>
              <span className="label">Tiempo</span>
              <input className="plain-input" inputMode="numeric" placeholder="mm:ss" value={d.time} onChange={(e) => set({ time: e.target.value })} />
              {pace && <span className="muted" style={{ fontSize: 11 }}>{pace}</span>}
            </label>
            {d.sport !== 'gym' && (
              <div className="card card--tight stack" style={{ flex: 1, gap: 6 }}>
                <span className="label">Intensidad · opcional</span>
                <div className="row" style={{ gap: 4 }}>
                  {ZONES.map((z) => (
                    <button key={z} onClick={() => set({ zone: d.zone === z ? undefined : z })} aria-pressed={d.zone === z} style={{ flex: 1, height: 30, borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 600, background: d.zone === z ? 'var(--blue)' : 'var(--surface-2)', color: d.zone === z ? '#fff' : 'var(--muted)' }}>Z{z}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="card mt-12" style={{ padding: '12px 14px' }}>
        <div className="between">
          <label htmlFor="notes" className="label">{d.sport === 'rest' ? 'Notas' : 'Estructura · texto libre'}</label>
          {d.notes && <button onClick={() => set({ notes: '' })} style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: 12, padding: 4 }}>Borrar</button>}
        </div>
        {cfg.inserts.length > 0 && (
          <div className="chips mt-8">
            {cfg.inserts.map((x) => <button key={x} className="chip chip--dashed" onClick={() => insert(x)}>+ {x}</button>)}
          </div>
        )}
        <textarea ref={notesRef} id="notes" className="field-input mt-8" style={{ border: 'none', background: 'transparent', padding: 0, minHeight: 72 }} placeholder="Escribe la sesión o usa los atajos" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>

      {d.sport !== 'rest' && (
        <div className="mt-12">
          <Segmented<Status> value={d.status} onChange={(status) => set({ status })} options={[{ id: 'planned', label: 'Planificada' }, { id: 'done', label: 'Hecha' }]} />
        </div>
      )}

      {editId && (
        <div className="stack mt-20" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-ghost" data-haptic="success" style={{ flex: 1, fontSize: 13 }} onClick={async () => { await duplicateSession(editId, addDays(d.date, 7)); toast.show('Copiada a la semana siguiente'); }}>
              <IconCopy size={16} /> Repetir en 7 días
            </button>
            <button className="btn-ghost" data-haptic="success" style={{ flex: 1, fontSize: 13 }} onClick={async () => { const b = build(); await saveTemplate({ sport: b.sport, subtype: b.subtype, title: b.title, notes: b.notes, distanceM: b.distanceM, gymTags: b.gymTags }); toast.show('Guardada como plantilla'); }}>
              <IconTemplate size={16} /> Guardar plantilla
            </button>
          </div>
          <button className="btn-ghost btn-danger" data-haptic="warning" onClick={async () => { if (confirm('¿Eliminar esta sesión?')) { await deleteSession(editId); nav(-1); } }}>
            <IconTrash size={16} /> Eliminar
          </button>
        </div>
      )}

      <div className="footer-cta">
        <button className="btn-primary" data-haptic="success" onClick={save} disabled={distInvalid || timeInvalid}>
          <IconCheck size={20} stroke={2.4} /> {editId ? 'Guardar cambios' : 'Guardar sesión'}
        </button>
      </div>
      {toast.node}
    </main>
  );
}
