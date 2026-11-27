# Intermediario opcional (Cloudflare Worker)

Pulso intenta conectar con Garmin y Strava **directamente desde el móvil**. Si alguno no lo permite
(el navegador bloquea la petición por CORS), la app lo indica y puedes usar este intermediario.

1. Crea una cuenta gratuita en Cloudflare → *Workers & Pages* → *Create* → *Worker*.
2. Pega el contenido de `worker.js` y despliega.
3. (Recomendado) En *Settings → Variables*, añade `ALLOWED_ORIGIN` con el origen de tu app,
   por ejemplo `https://javiserranoc.github.io`, para que solo tu app pueda usarlo.
4. En Pulso: *Ajustes → Conexiones → Avanzado*, pega la URL del worker (`https://….workers.dev`).

Solo reenvía a `personal.connectapi.garmin.com`, `www.strava.com` y `api-v3.strava.com`, no guarda nada
y no registra las claves. El plan gratuito de Workers sobra para un uso personal.
