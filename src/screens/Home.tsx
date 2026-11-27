import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowRight, IconCheck, IconRefresh, IconSettings } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, updateSession } from '../db/db';
import { useSessions, useSetting } from '../db/hooks';
import { loadSampleData } from '../db/seed';
import { DAY_LETTERS, formatLong, greeting, isoWeek, parseISODate, today, weekDays } from '../domain/dates';
import { fmtDistance, fmtHours, fmtNumber } from '../domain/format';
import { SPORTS, subtypeName } from '../domain/sports';
import { weekProgress } from '../domain/stats';
import type { Session } from '../domain/types';
import { Ring, SportTile, useToast } from '../components/ui';
import { hasConnections, syncAll } from '../sync';

export default function Home() {
  const nav = useNavigate();
  const t = today();
  const [day, setDay] = useState(t);
  const days = weekDays(t);
  const sessions = useSessions(days[0], days[6]) ?? [];
  const total = useLiveQuery(() => db.sessions.count(), []);
  const name = useSetting<string>('name', '');
  const wp = weekProgress(sessions, t);
  const daySessions = sessions.filter((s) => s.date === day).sort((a, b) => a.createdAt - b.createdAt);
  const { week } = isoWeek(t);
  const toast = useToast();
  const connected = useLiveQuery(() => hasConnections(), [], false);
  const nextRace = useLiveQuery(() => db.sessions.where('date').aboveOrEqual(t).filter((s) => s.sport === 'race').first(), [t]);
  const raceDays = nextRace ? Math.round((parseISODate(nextRace.date).getTime() - parseISODate(t).getTime()) / 864e5) : null;
  const [syncing, setSyncing] = useState(false);
  const sync = async () => {
    setSyncing(true);
    try {
      toast.show((await syncAll(14)).text);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="screen">
      <header className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {greeting()}
            {name ? ',' : ''}
          </p>
          <h1 style={{ margin: '2px 0 0', fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 42, lineHeight: 1 }}>{name || 'Pulso'}</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {connected && (
            <button className="btn-round" aria-label="Sincronizar con Garmin y Strava" data-haptic="success" onClick={sync} disabled={syncing}>
              <IconRefresh size={20} stroke={1.8} style={syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
            </button>
          )}
          <Link to="/ajustes" className="btn-round" aria-label="Ajustes">
            <IconSettings size={20} stroke={1.8} />
          </Link>
        </div>
      </header>

      {total === 0 && (
        <section className="card mt-20">
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Empieza aquí</p>
          <p className="muted" style={{ margin: '6px 0 14px', fontSize: 14, lineHeight: 1.5 }}>
            Registra tu primera sesión o carga un mes de ejemplo (noviembre de 2026) para ver la app con datos.
          </p>
          <div className="row">
            <button className="btn-ghost btn-soft-blue" data-haptic="success" onClick={() => loadSampleData()}>
              Cargar ejemplo
            </button>
            <Link className="btn-ghost" to={`/sesion/nueva?fecha=${t}`}>
              Primera sesión
            </Link>
          </div>
        </section>
      )}

      {nextRace && raceDays != null && raceDays <= 120 && (
        <Link to={`/sesion/${nextRace.id}`} className="card card--tight row mt-16" style={{ gap: 12, color: 'inherit' }}>
          <SportTile sport="race" size={40} on />
          <span className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{nextRace.title || 'Competición'}</span>
            <span className="muted" style={{ fontSize: 12 }}>{formatLong(nextRace.date)}{nextRace.distanceM ? ` · ${fmtDistance('race', nextRace.distanceM)}` : ''}</span>
          </span>
          <span className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="num" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{raceDays === 0 ? '¡Hoy!' : raceDays}</span>
            {raceDays > 0 && <span className="muted" style={{ fontSize: 11 }}>{raceDays === 1 ? 'día' : 'días'}</span>}
          </span>
        </Link>
      )}

      <div className="between mt-20" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{formatLong(day)}</span>
        <span className="muted" style={{ fontSize: 13 }}>
          Semana {week}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, marginTop: 10 }}>
        {days.map((d, i) => {
          const ds = sessions.filter((s) => s.date === d && s.sport !== 'rest');
          const selected = d === day;
          const past = d < t;
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              aria-pressed={selected}
              aria-label={formatLong(d)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '9px 0', borderRadius: 14,
                border: selected || past || d === t ? '1px solid transparent' : '1px solid rgba(255,255,255,0.07)',
                background: selected ? 'var(--blue)' : past || d === t ? 'var(--surface)' : 'transparent',
                color: selected ? '#fff' : past || d === t ? 'var(--text)' : 'var(--muted)'
              }}
            >
              <span style={{ fontSize: 11, color: selected ? '#DCE8FF' : 'var(--muted)' }}>{DAY_LETTERS[i]}</span>
              <span className="num" style={{ fontSize: 15, fontWeight: d === t ? 700 : 600 }}>
                {parseISODate(d).getDate()}
              </span>
              <span style={{ display: 'flex', gap: 3, height: 4 }}>
                {ds.slice(0, 3).map((s) => (
                  <i key={s.id} style={{ width: 4, height: 4, borderRadius: 2, background: selected ? '#fff' : s.status === 'done' ? 'var(--icon)' : '#4A505A' }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <section className="card mt-12 row" style={{ gap: 20, padding: 18 }}>
        <Ring ratio={wp.ratio}>
          <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>
            {Math.round(wp.ratio * 100)}%
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            del plan
          </span>
        </Ring>
        <div className="stack" style={{ flex: 1, gap: 11 }}>
          <div className="between">
            <span className="muted" style={{ fontSize: 13 }}>Sesiones</span>
            <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>
              {wp.doneSessions} / {wp.totalSessions}
            </span>
          </div>
          <div className="between">
            <span className="muted" style={{ fontSize: 13 }}>Tiempo</span>
            <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>{wp.durationS ? fmtHours(wp.durationS) : '—'}</span>
          </div>
          <div className="between">
            <span className="muted" style={{ fontSize: 13 }}>Pendientes</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-text)' }}>{wp.totalSessions - wp.doneSessions}</span>
          </div>
        </div>
      </section>

      <section className="card mt-12">
        <div className="between">
          <span className="label">{day === t ? 'Hoy' : formatLong(day)}</span>
          <Link to={`/sesion/nueva?fecha=${day}`} style={{ fontSize: 13, fontWeight: 600 }}>
            + Añadir
          </Link>
        </div>
        {daySessions.length === 0 && <p className="empty" style={{ margin: '12px 0 2px' }}>Sin sesiones este día.</p>}
        {daySessions.map((s) => (
          <DayRow key={s.id} s={s} onOpen={() => nav(`/sesion/${s.id}`)} />
        ))}
      </section>

      <div className="grid-3 mt-12">
        {(['swim', 'run', 'bike'] as const).map((sp) => (
          <div key={sp} className="card" style={{ padding: '14px 12px' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {SPORTS[sp].short}
            </span>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>
              {fmtNumber(wp.done[sp].value, sp === 'swim' ? 0 : 1)}
              <small className="muted" style={{ fontSize: 12 }}>
                {' '}
                {SPORTS[sp].unit}
              </small>
            </div>
          </div>
        ))}
      </div>

      <Link to={`/sesion/nueva?fecha=${day}`} className="btn-primary mt-16" style={{ borderRadius: 29, height: 58 }}>
        Registrar sesión <IconArrowRight size={18} stroke={2.2} />
      </Link>
      {toast.node}
    </main>
  );
}

function DayRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const sub = [SPORTS[s.sport].name, subtypeName(s.subtype), s.gymTags?.join(' + ')].filter(Boolean).join(' · ');
  return (
    <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
      <div className="row" style={{ gap: 12 }}>
        <button onClick={onOpen} className="row" style={{ flex: 1, gap: 12, border: 'none', background: 'none', padding: 0, textAlign: 'left', minWidth: 0 }}>
          <SportTile sport={s.sport} subtype={s.subtype} />
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{s.title || SPORTS[s.sport].name}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              {sub}
              {s.status === 'planned' ? ' · planificada' : ''}
            </span>
          </span>
        </button>
        {s.distanceM != null && <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{fmtDistance(s.sport, s.distanceM)}</span>}
        {s.status === 'done' && s.sport !== 'rest' && (
          <span className="pop" aria-label="Hecha" style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--blue-soft)', color: 'var(--blue-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <IconCheck size={15} stroke={2.6} />
          </span>
        )}
        {s.status === 'planned' && s.sport !== 'rest' && (
          <button className="btn-round" data-haptic="success" aria-label="Marcar como hecha" onClick={() => updateSession(s.id!, { status: 'done' })} style={{ width: 40, height: 40 }}>
            <IconCheck size={18} stroke={2.2} />
          </button>
        )}
      </div>
      {s.notes && (
        <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)', padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>{s.notes}</p>
      )}
    </div>
  );
}
