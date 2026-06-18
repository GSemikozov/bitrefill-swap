// Netlify Edge Function: proxies /api/uniswap/* to the Uniswap Trading API and
// injects x-api-key server-side. Needed because the trade-api gateway only
// serves CORS for localhost origins (verified 2026-06-12) — production browser
// calls must be same-origin. Bonus: the key stays out of the client bundle.

import { withObservability } from './_shared/observability.ts';

const UNISWAP_ORIGIN = 'https://trade-api.gateway.uniswap.org';
const PROXY_PREFIX = '/api/uniswap';

export default function handler(request: Request): Promise<Response> {
  return withObservability('uniswap', request, () => proxy(request));
}

async function proxy(request: Request): Promise<Response> {
  const env = (globalThis as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify
    ?.env;
  const apiKey = env?.get('UNISWAP_API_KEY') ?? env?.get('VITE_UNISWAP_API_KEY');

  if (!apiKey) {
    return Response.json({ error: 'UNISWAP_API_KEY is not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const upstreamUrl = `${UNISWAP_ORIGIN}${url.pathname.replace(PROXY_PREFIX, '')}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('x-api-key', apiKey);
  headers.delete('host');
  headers.delete('cookie');

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('access-control-allow-origin');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const config = { path: '/api/uniswap/*' };
