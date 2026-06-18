import * as Sentry from '@sentry/react';
import { env } from '@shared/config';

/** 0x-prefixed EVM address (40 hex) or tx hash (64 hex). */
const HEX_BLOB = /0x[0-9a-fA-F]{40,64}/g;

/**
 * Crypto app: wallet addresses, tx hashes and gift-card codes must never leave
 * the browser. Recursively redact anything that looks like on-chain data before
 * an event ships — viem error messages in particular embed addresses. This is
 * defense-in-depth on top of `sendDefaultPii: false`.
 */
function scrub<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(HEX_BLOB, '[redacted-0x]') as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrub(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = scrub(val);
    }
    return out as T;
  }
  return value;
}

let initialized = false;

/**
 * Initializes error monitoring. No-op without `VITE_SENTRY_DSN`, so the app
 * runs identically with monitoring off (local dev, CI). The DSN can point at
 * Sentry's free tier or a self-hosted GlitchTip — same SDK, no paid lock-in.
 *
 * Errors only on purpose: no performance tracing or session replay — those are
 * what consume quota and ship the most data. Add `tracesSampleRate` later if needed.
 */
export function initMonitoring(): void {
  if (initialized || !env.VITE_SENTRY_DSN) return;
  initialized = true;

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend: (event) => scrub(event),
    beforeBreadcrumb: (crumb) => scrub(crumb),
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } else if (import.meta.env.DEV) {
    console.error('[monitoring] captureError', error, context ?? '');
  }
}

/**
 * Records a swap-flow milestone as a Sentry breadcrumb so any later error
 * arrives with the funnel trail (quote → invoice → swap → pay → paid/failed).
 * Doubles as the cheapest form of the analytics funnel — a dedicated sink can
 * subscribe here later. Never pass addresses/amounts: keep payloads PII-free.
 */
export function trackFlowEvent(message: string, data?: Record<string, unknown>): void {
  if (env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb({ category: 'swap-flow', level: 'info', message, data });
  } else if (import.meta.env.DEV) {
    console.debug('[monitoring] %s', message, data ?? '');
  }
}
