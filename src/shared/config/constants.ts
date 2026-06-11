/** Fixed test product per the assignment: free, returns a real-looking code. */
export const GIFT_CARD_PRODUCT_ID = 'test-gift-card-code';

/** Bitrefill payment method for USDC on Base. */
export const PAYMENT_METHOD = 'usdc_base';

/** Invoice polling cadence (assignment suggests 3–5s). */
export const INVOICE_POLL_INTERVAL_MS = 4_000;

/** After this long of polling we switch to a "taking longer than usual" UI. */
export const INVOICE_POLL_SOFT_TIMEOUT_MS = 5 * 60_000;

/** How long a Uniswap quote is treated as fresh before auto-refresh. */
export const QUOTE_TTL_MS = 30_000;

/** Hide tokens worth less than this (when a USD price is known). */
export const DUST_THRESHOLD_USD = 0.01;

/**
 * Pre-invoice estimate of Bitrefill's USDC price over USD face value, observed
 * by probing: a $10 card priced at 10.5 USDC. The exact amount always comes
 * from the invoice (`payment.price`) — this only feeds the "≈ you pay" preview.
 */
export const USDC_PRICE_PREMIUM_ESTIMATE = 1.05;
