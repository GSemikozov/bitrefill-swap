/** Invoice polling cadence (assignment suggests 3–5s). */
export const INVOICE_POLL_INTERVAL_MS = 4_000;

/** After this long of polling we switch to a "taking longer than usual" UI. */
export const INVOICE_POLL_SOFT_TIMEOUT_MS = 5 * 60_000;
