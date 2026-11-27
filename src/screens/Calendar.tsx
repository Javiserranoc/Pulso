import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useSessions } from '../db/hooks';
import { DAY_LETTERS, formatLong, isoWeek, MONTHS, monthGrid, parseISODate, today } from '../domain/dates';
import { fmtDistance } from '../domain/format';
import { SPORTS } from '../domain/sports';
import { SportTile } from '../components/ui';

export default function Calendar() {
  const t = today();
  const now = parseISODate(t);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(t);
  const rows = monthGrid(ym.y, ym.m);
  const sessions = useSessions(rows[0][0], rows[rows.length - 1][6]) ?? [];
  const move = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const years = [ym.y - 1, ym.y, ym.y + 1, ym.y + 2];
  const selSessions = sessions.filter((s) => s.date === sel);
  const selWeek = isoWeek(sel).week;

  return (
    <main className="screen">
      <h1 className="title">Calendario</h1>
      <p className="subtitle">Semanas numeradas automáticamente</p>

      <div className="chips mt-16">
        {years.map((y) => (
          <button key={y} className="chip" aria-pressed={y === ym.y} onClick={() => setYm({ y, m: ym.m })}>
            {y}
          </button>
        ))}
      </div>

      <div className="between mt-12">
        <button className="btn-round" aria-label="Mes anterior" onClick={() => move(-1)}><IconChevronLeft size={18} /></button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{MONTHS[ym.m].charAt(0).toUpperCase() + MONTHS[ym.m].slice(1)} {ym.y}</span>
        <button className="btn-round" aria-label="Mes siguiente" onClick={() => move(1)}><IconChevronRight size={18} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, minmax(0,1fr))', gap: 4, marginTop: 10, fontSize: 11, textAlign: 'center' }} className="muted">
        <span>S</span>
        {DAY_LETTERS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="stack" style={{ gap: 4, marginTop: 6 }}>
        {rows.map((days) => {
          const wk = isoWeek(days[0]).week;
          const isSelWeek = days.includes(sel);
          return (
            <div key={days[0]} style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, minmax(0,1fr))', gap: 4, borderRadius: 14, background: isSelWeek ? 'var(--surface)' : 'transparent' }}>
              <Link to={`/plan?semana=${days[0]}`} className="num" aria-label={`Planificar semana ${wk}`} style={{ fontSize: 11, color: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{wk}</Link>
              {days.map((d) => {
                const out = parseISODate(d).getMonth() !== ym.m;
                const ds = sessions.filter((s) => s.date === d);
                const race = ds.some((s) => s.sport === 'race');
                const vol = ds.filter((s) => s.sport !== 'rest' && s.sport !== 'race');
                const isToday = d === t;
                const isSel = d === sel;
                return (
                  <button
                    key={d}
                    onClick={() => setSel(d)}
                    aria-label={formatLong(d)}
                    aria-pressed={isSel}
                    style={{
                      height: 50, borderRadius: 12, border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                      background: isToday ? 'var(--blue)' : isSel ? 'var(--surface-3)' : 'transparent',
                      boxShadow: race ? 'inset 0 0 0 1.5px var(--blue)' : 'none',
                      color: out ? '#3A3F48' : isToday ? '#fff' : 'var(--text)'
                    }}
                  >
                    <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>{parseISODate(d).getDate()}</span>
                    <span style={{ display: 'flex', gap: 3, height: 4 }}>
                      {!out && vol.slice(0, 3).map((s) => (
                        <i key={s.id} style={{ width: 4, height: 4, borderRadius: 2, background: isToday ? '#fff' : s.status === 'done' ? 'var(--icon)' : '#4A505A' }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <section className="card mt-16">
        <div className="between">
          <span style={{ fontSize: 15, fontWeight: 600 }}>{formatLong(sel)}</span>
          <Link to={`/sesion/nueva?fecha=${sel}`} style={{ fontSize: 13, fontWeight: 600 }}>+ Añadir</Link>
        </div>
        {selSessions.length === 0 && <p className="empty" style={{ margin: '10px 0 0' }}>Sin sesiones.</p>}
        {selSessions.map((s) => (
          <Link key={s.id} to={`/sesion/${s.id}`} className="list-row" style={{ color: 'inherit' }}>
            <SportTile sport={s.sport} subtype={s.subtype} size={36} />
            <span className="stack" style={{ flex: 1, gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{s.title || SPORTS[s.sport].name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{SPORTS[s.sport].name}{s.status === 'planned' ? ' · planificada' : ''}</span>
            </span>
            <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>{fmtDistance(s.sport, s.distanceM)}</span>
          </Link>
        ))}
        <Link to={`/plan?semana=${sel}`} className="btn-ghost mt-12" style={{ width: '100%' }}>Planificar semana {selWeek}</Link>
      </section>
    </main>
  );
}
