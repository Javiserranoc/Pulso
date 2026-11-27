import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconCopy, IconFileImport, IconRefresh } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting } from '../db/db';
import { importActivities } from '../sync/apply';
import { summaryText } from '../sync/activities';
import { parseActivityFiles } from '../sync/files';
import { fetchGarmin, saveGarmin, type GarminConfig } from '../sync/garmin';
import { authorizeUrl, exchangeCode, fetchStrava, redirectUri, saveStrava, type StravaConfig } from '../sync/strava';
import { Segmented, useToast } from '../components/ui';

const PENDING_KEY = 'pulso.stravaCode';

function since(iso?: string) {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Connections() {
  const nav = useNavigate();
  const toast = useToast();
  const garmin = useLiveQuery(() => db.settings.get('garmin').then((s) => (s?.value as GarminConfig | null) ?? null), []);
  const strava = useLiveQuery(() => db.settings.get('strava').then((s) => (s?.value as StravaConfig | null) ?? null), []);
  const proxy = useLiveQuery(() => getSetting<string>('proxyUrl', ''), []) ?? '';
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [busy, setBusy] = useState<string | null>(null);
  const [gKey, setGKey] = useState('');
  const [sId, setSId] = useState('');
  const [sSecret, setSSecret] = useState('');
  const [code, setCode] = useState('');
  const [orphanCode, setOrphanCode] = useState<string | null>(null);
  const [proxyDraft, setProxyDraft] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Vuelta de Strava: el código lo deja main.tsx en sessionStorage.
  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (!pending || strava === undefined) return;
    sessionStorage.removeItem(PENDING_KEY);
    if (!strava?.clientId) {
      // En iPhone la vuelta puede abrirse en Safari y no en la app instalada (no comparten datos).
      setOrphanCode(pending);
      return;
    }
    run('strava-code', async () => {
      const c = await exchangeCode(pending);
      return `Strava conectado${c.athlete ? ` · ${c.athlete}` : ''}`;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strava]);

  async function run(id: string, fn: () => Promise<string>) {
    setBusy(id);
    try {
      toast.show(await fn());
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Algo ha fallado');
    } finally {
      setBusy(null);
    }
  }

  const syncGarmin = () => run('garmin', async () => { const r = await fetchGarmin(Number(days)); return `Garmin: ${summaryText(await importActivities(r.activities, r.ignored))}`; });
  const syncStrava = () => run('strava', async () => { const r = await fetchStrava(Number(days)); return `Strava: ${summaryText(await importActivities(r.activities, r.ignored))}`; });
  const importFiles = (files: FileList | null) =>
    files?.length &&
    run('files', async () => {
      const r = await parseActivityFiles(Array.from(files));
      const s = await importActivities(r.activities, r.ignored);
      if (fileRef.current) fileRef.current.value = '';
      return r.errors.length ? `${summaryText(s)} · ${r.errors[0]}` : summaryText(s);
    });

  return (
    <main className="screen">
      <header className="row">
        <button className="btn-round" aria-label="Volver" onClick={() => nav(-1)}><IconArrowLeft size={20} /></button>
        <h1 className="title" style={{ fontSize: 24 }}>Conexiones</h1>
      </header>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '12px 0 0' }}>
        Trae tus actividades y completa solas las sesiones del plan: la distancia y el tiempo se rellenan y la sesión queda como hecha. No se duplica nada, ni aunque uses Garmin y Strava a la vez. Las claves se guardan solo en este dispositivo y no salen en las copias.
      </p>

      <div className="mt-16">
        <span className="label">Periodo a sincronizar</span>
        <div className="mt-8">
          <Segmented<'7' | '30' | '90'> value={days} onChange={setDays} options={[{ id: '7', label: '7 días' }, { id: '30', label: '30 días' }, { id: '90', label: '90 días' }]} />
        </div>
      </div>

      {orphanCode && (
        <section className="card card--focus mt-16">
          <span style={{ fontSize: 15, fontWeight: 600 }}>Código de Strava</span>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '6px 0 10px' }}>
            Strava ha vuelto a Safari en vez de a la app instalada. Copia este código, abre Pulso desde la pantalla de inicio y pégalo en Ajustes → Conexiones → Strava.
          </p>
          <div className="row">
            <code style={{ flex: 1, fontSize: 13, wordBreak: 'break-all', padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>{orphanCode}</code>
            <button className="btn-round" aria-label="Copiar código" onClick={() => navigator.clipboard?.writeText(orphanCode).then(() => toast.show('Código copiado'))}><IconCopy size={18} /></button>
          </div>
        </section>
      )}

      {/* Garmin */}
      <section className="card mt-16">
        <div className="between">
          <span style={{ fontSize: 17, fontWeight: 600 }}>Garmin Connect</span>
          <span className="muted" style={{ fontSize: 12 }}>{garmin?.apiKey ? `Conectado · ${since(garmin.lastSync)}` : 'Sin conectar'}</span>
        </div>
        {!garmin?.apiKey ? (
          <>
            <ol className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: '10px 0', paddingLeft: 18 }}>
              <li>Entra en Garmin Connect <b>desde la web</b> (connect.garmin.com).</li>
              <li>Ajustes → <b>Personal API Key</b> → Crear clave; acepta las condiciones y elige la caducidad.</li>
              <li>Copia la clave (solo se muestra una vez) y pégala aquí.</li>
            </ol>
            <input className="field-input" type="password" autoComplete="off" placeholder="Clave personal de Garmin" value={gKey} onChange={(e) => setGKey(e.target.value)} />
            <button className="btn-primary mt-12" disabled={!gKey.trim() || !!busy} data-haptic="success" onClick={() => run('garmin', async () => { await saveGarmin({ apiKey: gKey.trim() }); setGKey(''); const r = await fetchGarmin(Number(days)); return `Garmin conectado · ${summaryText(await importActivities(r.activities, r.ignored))}`; })}>
              {busy === 'garmin' ? 'Conectando…' : 'Guardar y sincronizar'}
            </button>
          </>
        ) : (
          <div className="row mt-12" style={{ gap: 8 }}>
            <button className="btn-ghost btn-soft-blue" style={{ flex: 1 }} disabled={!!busy} data-haptic="success" onClick={syncGarmin}><IconRefresh size={16} /> {busy === 'garmin' ? 'Sincronizando…' : 'Sincronizar'}</button>
            <button className="btn-ghost btn-danger" data-haptic="warning" onClick={() => confirm('¿Quitar la conexión con Garmin? Las sesiones importadas se quedan.') && saveGarmin(null)}>Quitar</button>
          </div>
        )}
      </section>

      {/* Strava */}
      <section className="card mt-12">
        <div className="between">
          <span style={{ fontSize: 17, fontWeight: 600 }}>Strava</span>
          <span className="muted" style={{ fontSize: 12 }}>{strava?.refreshToken ? `Conectado${strava.athlete ? ` · ${strava.athlete}` : ''} · ${since(strava.lastSync)}` : strava?.clientId ? 'Falta autorizar' : 'Sin conectar'}</span>
        </div>
        {!strava?.clientId ? (
          <>
            <ol className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: '10px 0', paddingLeft: 18 }}>
              <li>Strava pide suscripción para usar su API desde junio de 2026.</li>
              <li>En <b>strava.com/settings/api</b> crea una aplicación. En «Authorization Callback Domain» pon <b>{location.hostname}</b>.</li>
              <li>Copia aquí el Client ID y el Client Secret.</li>
            </ol>
            <input className="field-input" inputMode="numeric" placeholder="Client ID" value={sId} onChange={(e) => setSId(e.target.value)} />
            <input className="field-input mt-8" type="password" autoComplete="off" placeholder="Client Secret" value={sSecret} onChange={(e) => setSSecret(e.target.value)} />
            <button className="btn-primary mt-12" disabled={!sId.trim() || !sSecret.trim()} onClick={async () => { await saveStrava({ clientId: sId.trim(), clientSecret: sSecret.trim() }); setSId(''); setSSecret(''); }}>Guardar</button>
          </>
        ) : !strava.refreshToken ? (
          <>
            <a className="btn-primary mt-12" href={authorizeUrl(strava.clientId)} style={{ background: '#FC5200' }}>Autorizar en Strava</a>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: '10px 0 6px' }}>Si al volver de Strava se abre Safari en vez de la app, copia el código que aparece y pégalo aquí:</p>
            <div className="row">
              <input className="field-input" placeholder="Código de Strava" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn-pill" disabled={!code.trim() || !!busy} onClick={() => run('strava-code', async () => { const c = await exchangeCode(code); setCode(''); return `Strava conectado${c.athlete ? ` · ${c.athlete}` : ''}`; })}>Usar</button>
            </div>
            <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>Dirección de vuelta: {redirectUri()}</p>
            <button className="btn-ghost btn-danger mt-12" style={{ width: '100%' }} onClick={() => saveStrava(null)}>Cambiar Client ID / Secret</button>
          </>
        ) : (
          <div className="row mt-12" style={{ gap: 8 }}>
            <button className="btn-ghost btn-soft-blue" style={{ flex: 1 }} disabled={!!busy} data-haptic="success" onClick={syncStrava}><IconRefresh size={16} /> {busy === 'strava' ? 'Sincronizando…' : 'Sincronizar'}</button>
            <button className="btn-ghost btn-danger" data-haptic="warning" onClick={() => confirm('¿Quitar la conexión con Strava? Las sesiones importadas se quedan.') && saveStrava(null)}>Quitar</button>
          </div>
        )}
      </section>

      {/* Archivos */}
      <section className="card mt-12">
        <span style={{ fontSize: 17, fontWeight: 600 }}>Importar archivos</span>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '6px 0 12px' }}>
          Sin cuentas ni claves: .fit, .gpx, .tcx o el .zip de «Exportar original» de Garmin Connect. Puedes elegir varios a la vez.
        </p>
        <button className="btn-ghost" style={{ width: '100%' }} disabled={!!busy} onClick={() => fileRef.current?.click()}><IconFileImport size={16} /> {busy === 'files' ? 'Leyendo…' : 'Elegir archivos'}</button>
        <input ref={fileRef} type="file" multiple accept=".fit,.gpx,.tcx,.zip" hidden onChange={(e) => importFiles(e.target.files)} />
      </section>

      {/* Avanzado */}
      <details className="card mt-12">
        <summary style={{ fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Avanzado · intermediario</summary>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 10px' }}>
          Solo si Garmin o Strava no dejan conectar desde el navegador. Despliega el worker de la carpeta <code>proxy/</code> del repositorio en Cloudflare (gratis) y pega aquí su URL.
        </p>
        <input className="field-input" inputMode="url" placeholder="https://…workers.dev" value={proxyDraft ?? proxy} onChange={(e) => setProxyDraft(e.target.value)} onBlur={() => proxyDraft != null && setSetting('proxyUrl', proxyDraft.trim())} />
      </details>
      {toast.node}
    </main>
  );
}

export { PENDING_KEY };
