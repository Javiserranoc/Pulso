# Pulso

PWA para planificar y registrar entrenos de **correr, natación, bici y gimnasio** y ver los acumulados por **semana, mes y año**, por deporte y por subcategoría (piscina / aguas abiertas, calle / rodillo). Sustituye a un Excel con una pestaña por mes.

Primera versión (v0.1): MVP navegable, datos guardados solo en el dispositivo.

## Qué hace

| Pantalla | Qué permite |
| --- | --- |
| **Inicio** | Cuenta atrás a la próxima competición, día y semana actual, % del plan hecho, sesiones del día (marcar como hecha con un toque), totales de la semana y botón para registrar. |
| **Resumen** | Semana (hecho frente a plan + gráficas por día que se deslizan), mes (por semanas, con objetivos) y año (por meses, reparto por subcategoría, objetivo anual, mejor mes, mejor semana y comparación con el año anterior). |
| **Calendario** | Cualquier año y mes, con número de semana ISO automático, puntos por sesión y competiciones marcadas. |
| **Plan** | Semana de lunes a domingo; copiar la semana anterior; plantillas de semana completa; añadir desde recientes y plantillas con un toque y repetir 4, 8 o 12 semanas; objetivo semanal calculado. |
| **Registrar / editar sesión** | Formulario que cambia según el deporte. Estructura en texto libre con atajos (plantillas, recientes, distancias rápidas, botones «+ Series», «+ ×», «+ rec.»…), tiempo con ritmo calculado e intensidad Z1–Z5 opcional. Repetir en 7 días, guardar como plantilla, eliminar. |
| **Conexiones** | Garmin (API personal), Strava (OAuth) e importar archivos .fit / .gpx / .tcx / .zip. Las actividades completan solas las sesiones planificadas (distancia, tiempo, hecha) sin duplicar, aunque uses Garmin y Strava a la vez. |
| **Ajustes** | Nombre, objetivos mensuales y anuales, recordatorio semanal en el calendario (.ics), fondo (cinta, puntos o ninguno), vibración, exportar/importar copia (.json), exportar a Excel (.csv), cargar el ejemplo de noviembre de 2026. |

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
2. Crea la variable `DEPLOY_PAGES` con valor `true`, en *Settings → Secrets and variables → Actions → Variables* o en el entorno `github-pages` (*Settings → Environments*).

Para no gastar el límite de Actions: no usa caché de npm, el artefacto de Pages caduca en 1 día y un último paso borra las cachés y los artefactos de cada ejecución. En repos privados, GitHub Pages necesita un plan de pago (Pro, Team o Enterprise); si no, se puede usar Netlify, Vercel o Cloudflare Pages con `npm run build` y la carpeta `dist`.

## Fondo animado

Se elige en Ajustes → Fondo:

- **Cinta** (por defecto, `src/components/RibbonBackground.tsx`): cintas de luz resueltas en una trama de puntos, en WebGL. Adaptado de *Ribbon Field* de [ThreeUI Community](https://github.com/MengTo/threeui) (MIT) con la paleta azul de Pulso, encuadre vertical e intensidad reducida. Si el dispositivo no tiene WebGL, se usa «Puntos».
- **Puntos** (`src/components/DotsBackground.tsx`): puntos en movimiento unidos por líneas finas, en Canvas 2D.
- **Ninguno**.

Ambos van a ~30 fps con resolución limitada a 2×, se pausan en segundo plano y se quedan quietos con «Reducir movimiento». Licencias de terceros en `THIRD_PARTY_NOTICES.md`.

## Animaciones y vibración

- Arranque «Latido» (`src/components/Splash.tsx`): se dibuja la línea de pulso, late el punto de hoy y aparece «Pulso». ~1,3 s, solo al abrir la app en frío; se salta con un toque.
- Entrada escalonada de cada pantalla, anillo y barras que crecen, botones que se hunden al pulsar, ✓ con rebote al marcar una sesión como hecha. Todo se desactiva si el sistema tiene «Reducir movimiento».
- Vibración (`src/lib/haptics.ts`): toque ligero en cualquier botón y doble toque al guardar o completar. En Android usa `navigator.vibrate`; en iPhone (Safari no lo soporta) usa el toque háptico del interruptor nativo de iOS 18+. Se desactiva en Ajustes.

## Garmin y Strava

Todo se hace desde el móvil; no hay servidor de Pulso. Las claves se guardan solo en el dispositivo y **no se incluyen en las copias exportadas**.

- **Garmin Connect · API personal** (oficial, solo lectura): en Garmin Connect **web** → Ajustes → *Personal API Key* → crear clave y pegarla en *Ajustes → Conexiones*. La app pide un token de 24 h con la clave y lista las actividades del periodo elegido.
- **Strava**: crea tu propia aplicación en `strava.com/settings/api` (en *Authorization Callback Domain* pon el dominio donde está publicada la app), pega Client ID y Client Secret y pulsa *Autorizar*. Desde junio de 2026 Strava exige suscripción para usar su API en el nivel estándar. En iPhone, si la vuelta de Strava se abre en Safari en vez de en la app instalada, la página muestra el código para copiarlo y pegarlo en la app.
- **Archivos**: .fit, .gpx, .tcx o el .zip de *Exportar original* de Garmin Connect; sin cuentas.
- **Emparejado**: cada actividad completa la sesión planificada del mismo día y deporte (o una apuntada a mano con la misma distancia o tiempo), conservando el título y la estructura; si no hay ninguna, se crea. Nada se duplica al sincronizar varias veces ni entre fuentes.
- **Si el navegador bloquea la conexión (CORS)**: `proxy/` tiene un intermediario mínimo para Cloudflare Workers (gratis). Ver `proxy/README.md`.

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
  sync/        Garmin, Strava, archivos .fit/.gpx/.tcx y emparejado con el plan
  components/  iconos de deporte, anillo, barras, carrusel, hoja inferior…
  screens/     Inicio, Resumen, Calendario, Plan, Formulario de sesión, Ajustes
  styles/      tokens del sistema visual (oscuro, plano, solo azul)
proxy/                  intermediario opcional para Cloudflare Workers
scripts/make-icons.py   genera los iconos de la PWA (latido blanco sobre azul)
```

Stack: React 19 + TypeScript + Vite, `vite-plugin-pwa` (Workbox), Dexie, React Router, Tabler Icons, fuentes Inter / Space Grotesk / Instrument Serif empaquetadas (funcionan sin conexión).

## Próximos pasos

- Importar el Excel actual (jul–nov 2026): pendiente del archivo.
- App de Garmin Connect IQ para ver el plan en el reloj (proyecto aparte, en Monkey C).
- Sincronización entre dispositivos (necesitaría un backend, p. ej. Supabase).
