import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight, IconCopy, IconPlus, IconTemplate, IconTrash } from '@tabler/icons-react';
import { addSession, applyWeekTemplate, copyWeek, deleteWeekTemplate, repeatWeekly, saveWeekTemplate, type WeekTemplate } from '../db/db';
import { useRecents, useSessions, useSetting, useTemplates } from '../db/hooks';
import { addDays, DAYS, formatLong, formatWeekRange, isoWeek, parseISODate, startOfWeek, today, weekDays } from '../domain/dates';
import { fmtDistance, fmtNumber } from '../domain/format';
import { SPORTS, subtypeName, VOLUME_SPORTS } from '../domain/sports';
import { weekProgress } from '../domain/stats';
import type { Sport, Subtype } from '../domain/types';
import { Sheet, SportIcon, SportTile, useToast } from '../components/ui';

export default function Plan() {
  const t = today();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const anchor = startOfWeek(params.get('semana') ?? t);
  const days = weekDays(anchor);
  const sessions = useSessions(days[0], days[6]) ?? [];
  const [addDay, setAddDay] = useState<string | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const toast = useToast();
  const { week } = isoWeek(anchor);
  const plan = weekProgress(sessions, anchor).plan;
  const go = (n: number) => setParams({ semana: addDays(anchor, 7 * n) }, { replace: true });

  const copyPrev = async () => {
    const n = await copyWeek(addDays(anchor, -7), anchor);
    toast.show(n ? `Copiadas ${n} sesiones de la semana ${isoWeek(addDays(anchor, -7)).week}` : 'No hay nada nuevo que copiar');
  };

  return (
    <main className="screen">
      <div className="between">
        <button className="btn-round" aria-label="Semana anterior" onClick={() => go(-1)}><IconChevronLeft size={18} /></button>
        <div className="stack" style={{ alignItems: 'center' }}>
          <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>Semana {week}</span>
          <span className="muted" style={{ fontSize: 12 }}>{formatWeekRange(anchor)} {anchor !== startOfWeek(t) ? '' : '· esta semana'}</span>
        </div>
        <button className="btn-round" aria-label="Semana siguiente" onClick={() => go(1)}><IconChevronRight size={18} /></button>
      </div>

      <div className="row mt-16" style={{ gap: 8 }}>
        <button className="btn-ghost btn-soft-blue" data-haptic="success" style={{ flex: 1, fontSize: 13 }} onClick={copyPrev}>
          <IconCopy size={16} /> Copiar semana anterior
        </button>
        <button className="btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => setTplOpen(true)}>
          <IconTemplate size={16} /> Plantillas
        </button>
      </div>
      {anchor === startOfWeek(t) && (
        <button className="btn-ghost mt-8" style={{ width: '100%', fontSize: 13 }} onClick={() => go(1)}>Planificar la semana siguiente →</button>
      )}

      <div className="mt-12">
        {days.map((d, i) => {
          const ds = sessions.filter((s) => s.date === d).sort((a, b) => a.createdAt - b.createdAt);
          const isToday = d === t;
          return (
            <div key={d} className="row" style={{ alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: i < 6 ? '1px solid var(--line)' : 'none' }}>
              <div className="stack" style={{ width: 44, flex: 'none', alignItems: 'center', paddingTop: 2 }}>
                <span style={{ fontSize: 11, color: isToday ? 'var(--blue-text)' : 'var(--muted)', fontWeight: isToday ? 600 : 400 }}>{DAYS[i].slice(0, 3).toUpperCase()}</span>
                <span className="num" style={{ fontSize: 16, fontWeight: 600, color: isToday ? 'var(--blue-text)' : 'var(--text)' }}>{parseISODate(d).getDate()}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36, alignItems: 'center' }}>
                {ds.length === 0 && <span className="empty">Sin sesiones</span>}
                {ds.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => nav(`/sesion/${s.id}`)}
                    className="row"
                    style={{ gap: 6, height: 36, padding: '0 10px', borderRadius: 12, fontSize: 13, color: s.status === 'done' ? 'var(--text)' : '#E1E4E9', background: s.status === 'done' ? 'var(--surface-2)' : 'var(--surface)', border: s.status === 'done' ? '1px solid transparent' : '1px dashed rgba(255,255,255,0.16)' }}
                  >
                    <span style={{ color: 'var(--muted)', display: 'flex' }}><SportIcon sport={s.sport} subtype={s.subtype} size={16} /></span>
                    {s.title || SPORTS[s.sport].name}
                  </button>
                ))}
              </div>
              <button className="btn-round" aria-label={`Añadir al ${DAYS[i]}`} onClick={() => setAddDay(d)} style={{ width: 36, height: 36, borderRadius: 12, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)' }}>
                <IconPlus size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Borde discontinuo = planificada · relleno = hecha</p>

      <section className="card mt-16" style={{ padding: '14px 16px' }}>
        <span className="label">Objetivo de la semana</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginTop: 8 }}>
          {VOLUME_SPORTS.map((sp) => (
            <div key={sp} className="stack">
              <span className="num" style={{ fontSize: 19, fontWeight: 600 }}>{fmtNumber(plan[sp].value, sp === 'swim' || sp === 'gym' ? 0 : 1)}</span>
              <span className="muted" style={{ fontSize: 11 }}>{sp === 'gym' ? 'gym' : `${SPORTS[sp].unit} ${SPORTS[sp].short.toLowerCase()}`}</span>
            </div>
          ))}
        </div>
      </section>

      <AddSheet day={addDay} onClose={() => setAddDay(null)} onAdded={(m) => { setAddDay(null); toast.show(m); }} />
      <WeekTemplatesSheet open={tplOpen} anchor={anchor} onClose={() => setTplOpen(false)} onDone={(m) => { setTplOpen(false); toast.show(m); }} />
      {toast.node}
    </main>
  );
}

interface Option {
  key: string;
  sport: Sport;
  subtype?: Subtype;
  title: string;
  notes: string;
  distanceM?: number;
  gymTags?: string[];
  meta: string;
}

function AddSheet({ day, onClose, onAdded }: { day: string | null; onClose: () => void; onAdded: (msg: string) => void }) {
  const nav = useNavigate();
  const recents = useRecents(10);
  const templates = useTemplates() ?? [];
  const [filter, setFilter] = useState<Sport | 'all'>('all');
  const [repeat, setRepeat] = useState(0);
  if (!day) return null;

  const seen = new Set<string>();
  const options: Option[] = [];
  const push = (o: Option) => {
    const k = `${o.sport}|${o.subtype ?? ''}|${o.title}`;
    if (seen.has(k)) return;
    seen.add(k);
    options.push({ ...o, key: k });
  };
  recents.forEach((s) => push({ ...s, key: '', meta: [SPORTS[s.sport].name, subtypeName(s.subtype), fmtDistance(s.sport, s.distanceM), 'reciente'].filter(Boolean).join(' · ') }));
  templates.forEach((tp) => push({ ...tp, key: '', meta: [SPORTS[tp.sport].name, subtypeName(tp.subtype), fmtDistance(tp.sport, tp.distanceM), 'plantilla'].filter(Boolean).join(' · ') }));
  const shown = options.filter((o) => filter === 'all' || o.sport === filter);

  const add = async (o: Pick<Option, 'sport' | 'subtype' | 'title' | 'notes' | 'distanceM' | 'gymTags'>) => {
    const s = { date: day, sport: o.sport, subtype: o.subtype, title: o.title, notes: o.notes, distanceM: o.distanceM, gymTags: o.gymTags, status: (day < today() ? 'done' : 'planned') as 'done' | 'planned' };
    await addSession(s);
    if (repeat) await repeatWeekly(s, repeat);
    onAdded(`${o.title} añadida al ${formatLong(day).split(',')[0].toLowerCase()}${repeat ? ` y ${repeat} semanas más` : ''}`);
  };

  return (
    <Sheet open onClose={onClose} label={`Añadir al ${formatLong(day)}`}>
      <div className="between">
        <div className="stack">
          <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>Añadir sesión</span>
          <span className="muted" style={{ fontSize: 13 }}>{formatLong(day)}</span>
        </div>
      </div>
      <div className="chips mt-16">
        {(['all', ...VOLUME_SPORTS] as const).map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'Todo' : SPORTS[f].short}</button>
        ))}
      </div>
      <div className="row mt-16" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13, flex: 1 }}>Repetir también</span>
        {[0, 4, 8, 12].map((n) => (
          <button key={n} className="chip chip--soft" aria-pressed={repeat === n} onClick={() => setRepeat(n)}>{n ? `${n} sem.` : 'No'}</button>
        ))}
      </div>
      <p className="label" style={{ margin: '18px 0 2px' }}>Recientes y plantillas · un toque</p>
      {shown.length === 0 && <p className="empty">Aún no hay sesiones de este deporte.</p>}
      {shown.slice(0, 8).map((o) => (
        <div key={o.key} className="list-row">
          <SportTile sport={o.sport} subtype={o.subtype} size={38} />
          <span className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{o.title}</span>
            <span className="muted" style={{ fontSize: 12 }}>{o.meta}</span>
          </span>
          <button className="btn-round" style={{ width: 38, height: 38, background: 'var(--surface-3)' }} aria-label={`Añadir ${o.title}`} data-haptic="success" onClick={() => add(o)}>
            <IconPlus size={16} />
          </button>
        </div>
      ))}
      <div className="row mt-12" style={{ gap: 8 }}>
        <button className="btn-ghost" data-haptic="success" style={{ flex: 1 }} onClick={() => add({ sport: 'rest', title: 'Descanso', notes: '' })}>Descanso</button>
        <button className="btn-ghost" style={{ flex: 1 }} onClick={() => nav(`/sesion/nueva?fecha=${day}&deporte=race`)}>Competición</button>
      </div>
      <Link to={`/sesion/nueva?fecha=${day}`} className="btn-primary mt-12">Sesión nueva con detalle…</Link>
    </Sheet>
  );
}

function WeekTemplatesSheet({ open, anchor, onClose, onDone }: { open: boolean; anchor: string; onClose: () => void; onDone: (msg: string) => void }) {
  const templates = useSetting<WeekTemplate[]>('weekTemplates', []);
  const [name, setName] = useState('');
  const { week } = isoWeek(anchor);
  return (
    <Sheet open={open} onClose={onClose} label="Plantillas de semana">
      <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>Plantillas de semana</span>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '6px 0 0' }}>Guarda una semana tipo y aplícala a cualquier otra con un toque. Se añade como planificada y no duplica lo que ya haya.</p>
      <p className="label" style={{ margin: '18px 0 4px' }}>Aplicar a la semana {week}</p>
      {templates.length === 0 && <p className="empty">Aún no hay plantillas.</p>}
      {templates.map((tp) => (
        <div key={tp.name} className="list-row">
          <span className="stack" style={{ flex: 1, gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{tp.name}</span>
            <span className="muted" style={{ fontSize: 12 }}>{tp.items.length} sesiones</span>
          </span>
          <button className="btn-pill" data-haptic="success" onClick={async () => onDone(`Añadidas ${await applyWeekTemplate(tp, anchor)} sesiones de «${tp.name}»`)}>Aplicar</button>
          <button className="btn-round" aria-label={`Borrar ${tp.name}`} data-haptic="warning" onClick={() => confirm(`¿Borrar la plantilla «${tp.name}»?`) && deleteWeekTemplate(tp.name)}><IconTrash size={16} /></button>
        </div>
      ))}
      <p className="label" style={{ margin: '20px 0 8px' }}>Guardar la semana {week} como plantilla</p>
      <div className="row">
        <input className="field-input" placeholder="Nombre (p. ej. Semana base)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-pill" disabled={!name.trim()} data-haptic="success" onClick={async () => { const tp = await saveWeekTemplate(name, anchor); setName(''); onDone(`Plantilla «${tp.name}» guardada (${tp.items.length} sesiones)`); }}>Guardar</button>
      </div>
    </Sheet>
  );
}
