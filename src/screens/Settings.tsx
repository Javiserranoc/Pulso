import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconDownload, IconFileSpreadsheet, IconUpload } from '@tabler/icons-react';
import { db, setSetting } from '../db/db';
import { downloadJSON, exportAll, importAll, isBackup, toCSV } from '../db/backup';
import { useSetting } from '../db/hooks';
import { loadSampleData } from '../db/seed';
import { today } from '../domain/dates';
import { useToast } from '../components/ui';
import { haptic, hapticsEnabled, setHapticsEnabled } from '../lib/haptics';

export default function Settings() {
  const nav = useNavigate();
  const toast = useToast();
  const name = useSetting<string>('name', '');
  const animated = useSetting<boolean>('animatedBackground', true);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [vibration, setVibration] = useState(hapticsEnabled());
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const exportJSON = async () => downloadJSON(await exportAll(), `pulso-copia-${today()}.json`);
  const exportCSV = async () => {
    const blob = new Blob([toCSV(await db.sessions.toArray())], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pulso-sesiones-${today()}.csv`;
    a.click();
  };
  const onImport = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!isBackup(data)) throw new Error('formato');
      const replace = confirm('¿Reemplazar todos los datos por los de la copia?\n\nAceptar = reemplazar · Cancelar = añadir solo lo que falta');
      const n = await importAll(data, replace ? 'replace' : 'merge');
      toast.show(`Importadas ${n} sesiones`);
    } catch {
      toast.show('Ese archivo no es una copia de Pulso');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <main className="screen">
      <header className="row">
        <button className="btn-round" aria-label="Volver" onClick={() => nav(-1)}><IconArrowLeft size={20} /></button>
        <h1 className="title" style={{ fontSize: 24 }}>Ajustes</h1>
      </header>

      <label className="stack mt-20" style={{ gap: 8 }}>
        <span className="label">Tu nombre</span>
        <input className="field-input" placeholder="Para el saludo del inicio" value={draftName ?? name} onChange={(e) => setDraftName(e.target.value)} onBlur={() => draftName != null && setSetting('name', draftName.trim())} />
      </label>

      <label className="card card--tight between mt-12" style={{ padding: '14px 16px' }}>
        <span className="stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Fondo animado</span>
          <span className="muted" style={{ fontSize: 12 }}>Puntos en movimiento detrás de la app</span>
        </span>
        <input type="checkbox" checked={animated} onChange={(e) => setSetting('animatedBackground', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--blue)' }} />
      </label>

      <label className="card card--tight between mt-12" style={{ padding: '14px 16px' }}>
        <span className="stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Vibración</span>
          <span className="muted" style={{ fontSize: 12 }}>Toque háptico al pulsar (iPhone con iOS 18 o superior)</span>
        </span>
        <input type="checkbox" data-haptic="none" checked={vibration} onChange={(e) => { setHapticsEnabled(e.target.checked); setVibration(e.target.checked); if (e.target.checked) haptic('success'); }} style={{ width: 22, height: 22, accentColor: 'var(--blue)' }} />
      </label>

      <section className="card mt-20">
        <span className="label">Tus datos</span>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 12px' }}>
          Todo se guarda solo en este dispositivo. Exporta una copia de vez en cuando para no perder nada si borras la app o cambias de móvil.
          {persisted === false && ' El navegador aún no ha garantizado el almacenamiento: instalar la app en la pantalla de inicio lo protege.'}
        </p>
        <div className="stack" style={{ gap: 8 }}>
          <button className="btn-ghost" onClick={exportJSON}><IconDownload size={16} /> Exportar copia (.json)</button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}><IconUpload size={16} /> Importar copia</button>
          <button className="btn-ghost" onClick={exportCSV}><IconFileSpreadsheet size={16} /> Exportar a Excel (.csv)</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
      </section>

      <section className="card mt-12">
        <span className="label">Instalar en el iPhone</span>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' }}>
          Abre esta página en Safari, pulsa Compartir y elige «Añadir a pantalla de inicio». Se abrirá a pantalla completa y funcionará sin conexión.
        </p>
      </section>

      <section className="card mt-12">
        <span className="label">Pruebas</span>
        <div className="stack mt-12" style={{ gap: 8 }}>
          <button className="btn-ghost" onClick={async () => { const n = await loadSampleData(); toast.show(`Cargadas ${n} sesiones de ejemplo`); }}>Cargar ejemplo de noviembre 2026</button>
          <button className="btn-ghost btn-danger" data-haptic="warning" onClick={async () => { if (confirm('¿Borrar todas las sesiones? No se puede deshacer.')) { await db.sessions.clear(); toast.show('Sesiones borradas'); } }}>Borrar todas las sesiones</button>
        </div>
      </section>

      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 24 }}>Pulso v{__APP_VERSION__}</p>
      {toast.node}
    </main>
  );
}
