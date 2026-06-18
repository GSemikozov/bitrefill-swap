/** Fixed test product per the assignment: free, returns a real-looking code. */
export const GIFT_CARD_PRODUCT_ID = 'test-gift-card-code';

/** Bitrefill payment method for USDC on Base. */
export const PAYMENT_METHOD = 'usdc_base';

/**
 * Pre-invoice estimate of Bitrefill's USDC price over USD face value, observed
 * by probing: a $10 card priced at 10.5 USDC. The exact amount always comes
 * from the invoice (`payment.price`) — this only feeds the "≈ you pay" preview.
 */
export const USDC_PRICE_PREMIUM_ESTIMATE = 1.05;
