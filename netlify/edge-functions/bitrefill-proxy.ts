// Netlify Edge Function: proxies /api/bitrefill/* to https://api.bitrefill.com/*
// and injects the Authorization header from a server-side env var. This mirrors the
// Vite dev proxy (vite.config.ts) so the Bitrefill key never reaches the client bundle.

const BITREFILL_ORIGIN = 'https://api.bitrefill.com';
const PROXY_PREFIX = '/api/bitrefill';

export default async function handler(request: Request): Promise<Response> {
  // Netlify global is available at runtime; typed loosely to keep this file
  // out of the app's TS project (it runs on Deno, not in the bundle).
  const apiKey = (globalThis as { Netlify?: { env: { get(k: string): string | undefined } } })
    .Netlify?.env.get('BITREFILL_API_KEY');

  if (!apiKey) {
    return Response.json({ error: 'BITREFILL_API_KEY is not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const upstreamUrl = `${BITREFILL_ORIGIN}${url.pathname.replace(PROXY_PREFIX, '')}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.delete('host');
  headers.delete('cookie');

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  });

  // Strip upstream CORS/security headers; same-origin response needs none.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('access-control-allow-origin');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const config = { path: '/api/bitrefill/*' };
