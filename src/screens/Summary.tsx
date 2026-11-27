import { useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useAllSessions } from '../db/hooks';
import { addDays, formatWeekRange, isoWeek, MONTHS, parseISODate, toISODate, today } from '../domain/dates';
import { fmtNumber } from '../domain/format';
import { SPORTS, VOLUME_SPORTS } from '../domain/sports';
import { bestMonth, inRange, isDone, monthRange, seriesByDay, seriesByMonth, seriesByWeek, totalsBySport, weekProgress, yearOverYear, yearRange, type SportTotal } from '../domain/stats';
import type { Session, Sport } from '../domain/types';
import { BarChart, Carousel, Segmented, SportTile, type Bar } from '../components/ui';

type Period = 'week' | 'month' | 'year';

const unitOf = (sp: Sport) => (sp === 'gym' ? 'ses.' : SPORTS[sp].unit!);
const fmtV = (sp: Sport, v: number) => fmtNumber(v, sp === 'swim' || sp === 'gym' ? 0 : 1);

function splitText(t: SportTotal): string {
  const subs = SPORTS[t.sport].subtypes;
  if (subs.length) return subs.map((s) => `${s.name} ${fmtV(t.sport, t.bySubtype[s.id] ?? 0)}`).join(' · ');
  if (t.sport === 'gym') return Object.entries(t.tags).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
  return `${t.count} ${t.count === 1 ? 'sesión' : 'sesiones'}`;
}

function ChartCard({ t, data }: { t: SportTotal; data: Bar[] }) {
  return (
    <div className="card">
      <div className="between" style={{ alignItems: 'baseline' }}>
        <span className="row" style={{ gap: 8, fontSize: 13 }}>
          <SportTile sport={t.sport} size={28} />
          {SPORTS[t.sport].name}
        </span>
        <span className="muted" style={{ fontSize: 12, textAlign: 'right' }}>{splitText(t)}</span>
      </div>
      <div className="num" style={{ fontSize: 30, fontWeight: 600, margin: '8px 0 12px' }}>
        {fmtV(t.sport, t.value)} <small className="muted" style={{ fontSize: 14 }}>{unitOf(t.sport)}</small>
      </div>
      <BarChart data={data} gap={data.length > 7 ? 5 : 12} />
    </div>
  );
}

function Nav({ label, sub, onPrev, onNext }: { label: string; sub?: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="between mt-12">
      <button className="btn-round" aria-label="Anterior" onClick={onPrev}><IconChevronLeft size={18} /></button>
      <div className="stack" style={{ alignItems: 'center' }}>
        <span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{label}</span>
        {sub && <span className="muted" style={{ fontSize: 12 }}>{sub}</span>}
      </div>
      <button className="btn-round" aria-label="Siguiente" onClick={onNext}><IconChevronRight size={18} /></button>
    </div>
  );
}

export default function Summary() {
  const t = today();
  const all = useAllSessions() ?? [];
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(t);
  const a = parseISODate(anchor);

  return (
    <main className="screen">
      <h1 className="title">Resumen</h1>
      <p className="subtitle">Volumen hecho por deporte</p>
      <div className="mt-16">
        <Segmented<Period> value={period} onChange={(p) => { setPeriod(p); setAnchor(t); }} options={[{ id: 'week', label: 'Semana' }, { id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' }]} />
      </div>
      {period === 'week' && <WeekView all={all} anchor={anchor} t={t} move={(n) => setAnchor(addDays(anchor, 7 * n))} />}
      {period === 'month' && (
        <MonthView all={all} year={a.getFullYear()} month={a.getMonth()} t={t} move={(n) => setAnchor(toISODate(new Date(a.getFullYear(), a.getMonth() + n, 1, 12)))} />
      )}
      {period === 'year' && <YearView all={all} year={a.getFullYear()} t={t} move={(n) => setAnchor(`${a.getFullYear() + n}-01-01`)} />}
    </main>
  );
}

function WeekView({ all, anchor, t, move }: { all: Session[]; anchor: string; t: string; move: (n: number) => void }) {
  const wp = weekProgress(all, anchor);
  const { week, year } = isoWeek(anchor);
  return (
    <>
      <Nav label={`Semana ${week}`} sub={`${formatWeekRange(anchor)} ${year}`} onPrev={() => move(-1)} onNext={() => move(1)} />
      <section className="card mt-12" style={{ padding: '14px 16px' }}>
        <div className="between muted" style={{ fontSize: 12 }}><span>Hecho</span><span>Plan</span></div>
        <div className="stack" style={{ gap: 14, marginTop: 12 }}>
          {VOLUME_SPORTS.map((sp) => {
            const d = wp.done[sp].value;
            const p = wp.plan[sp].value;
            return (
              <div key={sp} className="row" style={{ gap: 12 }}>
                <SportTile sport={sp} size={34} />
                <div style={{ flex: 1 }}>
                  <div className="between" style={{ alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14 }}>{SPORTS[sp].name}</span>
                    <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>
                      {fmtV(sp, d)} <span className="muted" style={{ fontSize: 12 }}>/ {fmtV(sp, p)} {unitOf(sp)}</span>
                    </span>
                  </div>
                  <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${p ? Math.min(100, (d / p) * 100) : 0}%` }} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="between mt-20" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Por días</span>
        <span className="muted" style={{ fontSize: 12 }}>Desliza ←</span>
      </div>
      <div className="mt-8">
        <Carousel labels={VOLUME_SPORTS.map((s) => SPORTS[s].name)}>
          {VOLUME_SPORTS.map((sp) => <ChartCard key={sp} t={wp.done[sp]} data={seriesByDay(all, anchor, sp, t)} />)}
        </Carousel>
      </div>
    </>
  );
}

function MonthView({ all, year, month, t, move }: { all: Session[]; year: number; month: number; t: string; move: (n: number) => void }) {
  const [from, to] = monthRange(year, month);
  const totals = totalsBySport(inRange(all, from, to).filter(isDone));
  return (
    <>
      <Nav label={`${MONTHS[month].charAt(0).toUpperCase() + MONTHS[month].slice(1)} ${year}`} onPrev={() => move(-1)} onNext={() => move(1)} />
      <div className="between mt-16" style={{ alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Por semanas</span>
        <span className="muted" style={{ fontSize: 12 }}>Desliza ←</span>
      </div>
      <div className="mt-8">
        <Carousel labels={VOLUME_SPORTS.map((s) => SPORTS[s].name)}>
          {VOLUME_SPORTS.map((sp) => <ChartCard key={sp} t={totals[sp]} data={seriesByWeek(all, year, month, sp, t)} />)}
        </Carousel>
      </div>
      <div className="grid-2 mt-12">
        {VOLUME_SPORTS.map((sp) => (
          <div key={sp} className="card card--tight">
            <span className="muted" style={{ fontSize: 12 }}>{SPORTS[sp].name}</span>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{fmtV(sp, totals[sp].value)} <small className="muted" style={{ fontSize: 12 }}>{unitOf(sp)}</small></div>
            <span className="muted" style={{ fontSize: 11 }}>{splitText(totals[sp])}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function YearView({ all, year, t, move }: { all: Session[]; year: number; t: string; move: (n: number) => void }) {
  const [sport, setSport] = useState<Sport>('swim');
  const [from, to] = yearRange(year);
  const tot = totalsBySport(inRange(all, from, to).filter(isDone))[sport];
  const yoy = yearOverYear(all, year, sport, year === parseISODate(t).getFullYear() ? t : `${year}-12-31`);
  const best = bestMonth(all, year, sport);
  const subs = SPORTS[sport].subtypes;
  const sa = subs.length ? tot.bySubtype[subs[0].id] ?? 0 : tot.value;
  const sb = subs.length ? tot.bySubtype[subs[1].id] ?? 0 : 0;
  return (
    <>
      <Nav label={String(year)} onPrev={() => move(-1)} onNext={() => move(1)} />
      <div className="chips mt-12">
        {VOLUME_SPORTS.map((sp) => (
          <button key={sp} className="chip" aria-pressed={sp === sport} onClick={() => setSport(sp)}>{SPORTS[sp].short}</button>
        ))}
      </div>
      <section className="card mt-12">
        <div className="between">
          <span className="muted" style={{ fontSize: 13 }}>Total {SPORTS[sport].name.toLowerCase()} {year}</span>
          {yoy != null && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-text)', padding: '4px 10px', borderRadius: 12, background: 'var(--blue-soft)' }}>
              {yoy >= 0 ? '+' : '−'}{fmtNumber(Math.abs(yoy * 100))} % vs {year - 1}
            </span>
          )}
        </div>
        <div className="num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1, marginTop: 6 }}>
          {fmtV(sport, tot.value)} <small className="muted" style={{ fontSize: 16 }}>{unitOf(sport)}</small>
        </div>
        {subs.length > 0 && (
          <>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12, background: 'var(--track)' }}>
              <div style={{ width: `${tot.value ? (sa / tot.value) * 100 : 0}%`, background: 'var(--blue)' }} />
              <div style={{ width: `${tot.value ? (sb / tot.value) * 100 : 0}%`, background: '#9CC2FF' }} />
            </div>
            <div className="row muted" style={{ gap: 16, marginTop: 8, fontSize: 12 }}>
              <span className="row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--blue)' }} />{subs[0].name} {fmtV(sport, sa)}</span>
              <span className="row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: '#9CC2FF' }} />{subs[1].name} {fmtV(sport, sb)}</span>
            </div>
          </>
        )}
        <div className="mt-16">
          <BarChart data={seriesByMonth(all, year, sport, t)} height={120} gap={5} />
        </div>
      </section>
      <div className="grid-2 mt-12">
        <div className="card card--tight">
          <span className="muted" style={{ fontSize: 12 }}>Mejor mes</span>
          <div className="num" style={{ fontSize: 18, fontWeight: 600, marginTop: 3 }}>
            {best ? `${MONTHS[best.month].charAt(0).toUpperCase() + MONTHS[best.month].slice(1)} · ${fmtV(sport, best.value)} ${unitOf(sport)}` : '—'}
          </div>
        </div>
        <div className="card card--tight">
          <span className="muted" style={{ fontSize: 12 }}>Sesiones</span>
          <div className="num" style={{ fontSize: 18, fontWeight: 600, marginTop: 3 }}>{tot.count}</div>
        </div>
      </div>
    </>
  );
}

