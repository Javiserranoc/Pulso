/**
 * Intermediario mínimo para Pulso (Cloudflare Worker, plan gratuito).
 * Solo hace falta si Garmin o Strava no aceptan peticiones directas desde el navegador (CORS).
 * Reenvía únicamente a los servicios de la lista y añade las cabeceras CORS.
 * No guarda nada: las claves viajan en cada petición desde el móvil y no se registran.
 *
 * Variable opcional ALLOWED_ORIGIN (p. ej. https://javiserranoc.github.io) para que
 * solo tu app pueda usarlo.
 */
const ALLOWED_HOSTS = new Set(['personal.connectapi.garmin.com', 'www.strava.com', 'api-v3.strava.com']);
const FORWARD_HEADERS = ['authorization', 'content-type', 'accept'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    if (allowed !== '*' && origin && origin !== allowed) return new Response('Origen no permitido', { status: 403 });
    const cors = {
      'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const target = new URL(request.url).searchParams.get('url');
    let url;
    try {
      url = new URL(target || '');
    } catch {
      return new Response('Falta ?url=', { status: 400, headers: cors });
    }
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return new Response('Destino no permitido', { status: 403, headers: cors });

    const headers = new Headers();
    for (const h of FORWARD_HEADERS) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }
    const upstream = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : await request.arrayBuffer()
    });
    const out = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  }
};
