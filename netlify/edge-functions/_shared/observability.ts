// Structured observability shared by the edge proxies. Runs on Deno (Netlify
// Edge) — a separate runtime from the client bundle, so it carries its own
// Sentry. Emits one JSON log line per request (Netlify function logs, also
// forwardable to CloudWatch/Datadog via Log Drains) and, when a DSN is set,
// reports upstream 5xx and thrown errors to Sentry. Secrets (the injected
// Authorization / x-api-key) and on-chain identifiers (0x… addresses/hashes)
// never leave here.

type Level = 'info' | 'warn' | 'error';

interface LogEntry {
  proxy: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  ok: boolean;
  error?: string;
}

// Minimal surface of the Sentry Deno SDK we use — keeps this Deno-only file off
// the app's TS project without pulling the SDK's types into the bundle build.
interface SentryLike {
  init(options: Record<string, unknown>): void;
  captureException(error: unknown, hint?: Record<string, unknown>): void;
  captureMessage(message: string, level?: string): void;
  flush(timeout?: number): Promise<boolean>;
}

function env(key: string): string | undefined {
  return (
    globalThis as { Netlify?: { env: { get(k: string): string | undefined } } }
  ).Netlify?.env.get(key);
}

/** Redact anything that looks like an EVM address (40 hex) or tx hash (64 hex). */
const HEX_BLOB = /0x[0-9a-fA-F]{40,64}/g;
function scrub<T>(value: T): T {
  if (typeof value === 'string') return value.replace(HEX_BLOB, '[redacted-0x]') as T;
  if (Array.isArray(value)) return value.map((v) => scrub(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrub(v);
    return out as T;
  }
  return value;
}

function emit(entry: LogEntry): void {
  const level: Level = entry.ok ? 'info' : entry.status >= 500 ? 'error' : 'warn';
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...entry });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// Server-side DSN (no VITE_ prefix), falling back to the client one so it works
// with the env var that's already configured. Sentry is loaded lazily and only
// when a DSN exists, so deployments without monitoring never pay the import cost
// or risk an import failure — and a failed load degrades to logs only.
const SENTRY_DSN = env('SENTRY_DSN') ?? env('VITE_SENTRY_DSN');
let sentry: SentryLike | null = null;
let sentryTried = false;

async function getSentry(): Promise<SentryLike | null> {
  if (!SENTRY_DSN) return null;
  if (!sentryTried) {
    sentryTried = true;
    try {
      const mod = (await import('npm:@sentry/deno@^8')) as unknown as SentryLike;
      // Errors only (no tracing); scrub on-chain identifiers from every event.
      mod.init({ dsn: SENTRY_DSN, tracesSampleRate: 0, beforeSend: (e: unknown) => scrub(e) });
      sentry = mod;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          ts: new Date().toISOString(),
          msg: 'sentry init failed',
          error: String(error),
        })
      );
    }
  }
  return sentry;
}

/**
 * Wraps a proxy handler with timing, structured logging and Sentry reporting.
 * Logs every outcome; reports upstream 5xx and thrown errors to Sentry, flushed
 * before returning since the edge isolate can freeze right after the response.
 * `proxy` is the slice name used to filter logs ('bitrefill' | 'uniswap').
 */
export async function withObservability(
  proxy: string,
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const { pathname } = new URL(request.url);

  try {
    const response = await handler();
    emit({
      proxy,
      requestId,
      method: request.method,
      path: pathname,
      status: response.status,
      duration_ms: Date.now() - start,
      ok: response.ok,
    });

    if (response.status >= 500) {
      const s = await getSentry();
      if (s) {
        s.captureMessage(`${proxy} proxy: upstream ${response.status}`, 'error');
        await s.flush(2000);
      }
    }
    return response;
  } catch (error) {
    emit({
      proxy,
      requestId,
      method: request.method,
      path: pathname,
      status: 502,
      duration_ms: Date.now() - start,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });

    const s = await getSentry();
    if (s) {
      s.captureException(error, { tags: { proxy }, extra: { requestId, path: pathname } });
      await s.flush(2000);
    }
    throw error;
  }
}
