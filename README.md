# Pulso

PWA para planificar y registrar entrenos de **correr, natación, bici y gimnasio** y ver los acumulados por **semana, mes y año**, por deporte y por subcategoría (piscina / aguas abiertas, calle / rodillo). Sustituye a un Excel con una pestaña por mes.

Primera versión (v0.1): MVP navegable, datos guardados solo en el dispositivo.

## Qué hace

| Pantalla | Qué permite |
| --- | --- |
| **Inicio** | Día y semana actual, % del plan hecho, sesiones del día (marcar como hecha con un toque), totales de la semana y botón para registrar. |
| **Resumen** | Semana (hecho frente a plan + gráficas por día que se deslizan), mes (por semanas) y año (por meses, reparto por subcategoría, mejor mes y comparación con el año anterior). |
| **Calendario** | Cualquier año y mes, con número de semana ISO automático, puntos por sesión y competiciones marcadas. |
| **Plan** | Semana de lunes a domingo; copiar la semana anterior; añadir desde recientes y plantillas con un toque; objetivo semanal calculado. |
| **Registrar / editar sesión** | Formulario que cambia según el deporte. Estructura en texto libre con atajos (plantillas, recientes, distancias rápidas, botones «+ Series», «+ ×», «+ rec.»…), tiempo con ritmo calculado e intensidad Z1–Z5 opcional. Repetir en 7 días, guardar como plantilla, eliminar. |
| **Ajustes** | Nombre, fondo animado on/off, exportar/importar copia (.json), exportar a Excel (.csv), cargar el ejemplo de noviembre de 2026. |

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de fechas, formatos, acumulados y base de datos
npm run build      # comprueba tipos y genera dist/ con el service worker
npm run preview    # sirve dist/ como en producción
```

Requiere Node 20 o superior.

## Instalar en el iPhone

1. Publica la app (ver abajo) o sirve `npm run preview -- --host` en la misma red.
2. Ábrela en **Safari** → Compartir → **Añadir a pantalla de inicio**.
3. Se abre a pantalla completa y funciona sin conexión. Requiere iOS 17 o superior.

### GitHub Pages

El flujo `.github/workflows/deploy.yml` pasa los tests y compila en cada push. Para publicar además en GitHub Pages:

1. *Settings → Pages → Source: GitHub Actions*.
2. *Settings → Secrets and variables → Actions → Variables*: crea `DEPLOY_PAGES` con valor `true`.

Para no gastar el límite de Actions: no usa caché de npm, el artefacto de Pages caduca en 1 día y un último paso borra las cachés y los artefactos de cada ejecución. En repos privados, GitHub Pages necesita un plan de pago (Pro, Team o Enterprise); si no, se puede usar Netlify, Vercel o Cloudflare Pages con `npm run build` y la carpeta `dist`.

## Fondo animado

Puntos en movimiento unidos por líneas finas (`src/components/DotsBackground.tsx`). Es un único `<canvas>` fijo detrás de la interfaz, sin re-renders de React: va a ~30 fps, limita la resolución a 2×, ajusta el número de puntos al tamaño de pantalla, se pausa en segundo plano y respeta «Reducir movimiento» de iOS. Se puede apagar en Ajustes.

## Datos

- Se guardan en el propio dispositivo con **IndexedDB** (vía Dexie). No hay servidor ni cuentas.
- La app pide almacenamiento persistente; una PWA instalada en la pantalla de inicio no pierde los datos por inactividad.
- **Haz copias** desde Ajustes → Exportar copia. Sirven para cambiar de móvil o recuperar datos.
- La semana no se guarda: se calcula de la fecha (ISO 8601, lunes a domingo). Los acumulados se calculan siempre a partir de las sesiones.
- Distancias guardadas siempre en metros; se muestran en m (natación) o km (correr, bici).

## Estructura

```
src/
  domain/      tipos, deportes (unidades, subcategorías, plantillas), fechas ISO, formatos, acumulados
  db/          base de datos local, copias de seguridad, datos de ejemplo, hooks de React
  components/  iconos de deporte, anillo, barras, carrusel, hoja inferior…
  screens/     Inicio, Resumen, Calendario, Plan, Formulario de sesión, Ajustes
  styles/      tokens del sistema visual (oscuro, plano, solo azul)
scripts/make-icons.py   genera los iconos de la PWA
```

Stack: React 19 + TypeScript + Vite, `vite-plugin-pwa` (Workbox), Dexie, React Router, Tabler Icons, fuentes Inter / Space Grotesk / Instrument Serif empaquetadas (funcionan sin conexión).

## Próximos pasos

Según el alcance definido en el diseño:

- **Fase 1 (pendiente):** importar el Excel actual (jul–nov 2026).
- **Fase 2:** competiciones con cuenta atrás, objetivos mensuales y anuales, récords, plantillas de semana completa, aviso para planificar.
- **Fase 3:** leer actividades de Apple Salud / Garmin, app de Garmin Connect IQ, sincronización entre dispositivos (necesitaría un backend, p. ej. Supabase).
