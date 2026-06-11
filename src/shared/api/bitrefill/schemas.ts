import { z } from 'zod';

/** Bitrefill v2 wraps every payload in `{ meta, data }` — callers receive `data`. */
function envelope<S extends z.ZodType>(data: S) {
  return z.object({ data });
}

/**
 * `amount` is the USD denomination. `price` is in the account's display currency
 * (satoshis for this account) and must NOT be used — the exact USDC cost comes
 * only from the invoice's `payment.price`.
 */
const giftCardPackageSchema = z.object({
  id: z.string(),
  value: z.string(),
  amount: z.number(),
});

const giftCardProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string(),
  in_stock: z.boolean(),
  range: z.object({
    min: z.number(),
    max: z.number(),
    step: z.number(),
  }),
  packages: z.array(giftCardPackageSchema),
});

export const productResponseSchema = envelope(giftCardProductSchema);

/**
 * Observed pre-payment: invoice "not_delivered", payment "unpaid".
 * `address` is absent for the balance payment method (demo mode) — only
 * crypto methods like usdc_base include a destination address.
 */
const invoicePaymentSchema = z.object({
  method: z.string(),
  address: z.string().optional(),
  currency: z.string(),
  /** USDC base units (6 decimals) for usdc_base: 10500000 = 10.5 USDC. */
  price: z.number(),
  status: z.string(),
});

const invoiceOrderRefSchema = z.object({
  id: z.string(),
  status: z.string(),
  delivered_time: z.string().nullable().optional(),
});

const invoiceSchema = z.object({
  id: z.string(),
  status: z.string(),
  payment: invoicePaymentSchema,
  orders: z.array(invoiceOrderRefSchema),
});

export const invoiceResponseSchema = envelope(invoiceSchema);

/**
 * Redemption fields are intentionally permissive: their exact location is only
 * observable on a delivered order (the unpaid probe doesn't include them).
 * `extractRedemptionCode` checks all known candidates.
 */
const orderSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  product: z.looseObject({
    id: z.string(),
    name: z.string(),
    value: z.string(),
    currency: z.string(),
  }),
  delivered_time: z.string().nullable().optional(),
  redemption_info: z
    .looseObject({
      code: z.string().optional(),
      pin: z.string().optional(),
      link: z.string().optional(),
      instructions: z.string().optional(),
    })
    .optional(),
  code: z.string().optional(),
  pin: z.string().optional(),
  link: z.string().optional(),
});

export const orderResponseSchema = envelope(orderSchema);

export type GiftCardProduct = z.infer<typeof giftCardProductSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type BitrefillOrder = z.infer<typeof orderSchema>;
