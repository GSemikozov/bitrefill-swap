import { env, GIFT_CARD_PRODUCT_ID, isDemoPayment, PAYMENT_METHOD } from '@shared/config';
import { apiRequest } from '../client';
import {
  type BitrefillOrder,
  type GiftCardProduct,
  type Invoice,
  invoiceResponseSchema,
  orderResponseSchema,
  productResponseSchema,
} from './schemas';

// No Authorization header anywhere in this file: requests go to the same-origin
// /api/bitrefill proxy, which injects the key server-side (dev proxy / edge function).
const base = env.VITE_BITREFILL_API_BASE;

export async function fetchGiftCardProduct(): Promise<GiftCardProduct> {
  const response = await apiRequest(`${base}/products/${GIFT_CARD_PRODUCT_ID}?currency=USDC`, {
    schema: productResponseSchema,
  });
  return response.data;
}

export interface CreateInvoiceParams {
  /** USD denomination of the gift card, e.g. 10. */
  value: number;
  /** Connected wallet address — Bitrefill refunds here if anything goes wrong. */
  refundAddress: string;
}

/**
 * Exported for tests. Demo mode pays from the test account's balance —
 * Bitrefill never charges it for the test product (verified live 2026-06-12),
 * so the invoice completes by itself with no on-chain payment.
 */
export function buildInvoicePayload(params: CreateInvoiceParams, demo = isDemoPayment()) {
  const products = [{ product_id: GIFT_CARD_PRODUCT_ID, value: params.value }];
  if (demo) {
    return { products, payment_method: 'balance', auto_pay: true };
  }
  return { products, payment_method: PAYMENT_METHOD, refund_address: params.refundAddress };
}

export async function createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
  const response = await apiRequest(`${base}/invoices`, {
    method: 'POST',
    body: buildInvoicePayload(params),
    schema: invoiceResponseSchema,
  });
  return response.data;
}

export async function fetchInvoice(invoiceId: string): Promise<Invoice> {
  const response = await apiRequest(`${base}/invoices/${invoiceId}`, {
    schema: invoiceResponseSchema,
  });
  return response.data;
}

export async function fetchOrder(orderId: string): Promise<BitrefillOrder> {
  const response = await apiRequest(`${base}/orders/${orderId}`, {
    schema: orderResponseSchema,
  });
  return response.data;
}

/**
 * Invoice statuses that mean payment has been accepted. The assignment PDF says
 * poll for `payment_received`/`complete`, but a live v2 paid invoice reports
 * `all_delivered` (observed 2026-06-12) — so we also accept it, plus
 * `payment.status === 'complete'` as a belt-and-braces signal.
 */
export function isInvoicePaid(invoice: Invoice): boolean {
  return (
    invoice.status === 'payment_received' ||
    invoice.status === 'complete' ||
    invoice.status === 'all_delivered' ||
    invoice.payment.status === 'complete'
  );
}

/** Statuses after which polling is pointless. */
export function isInvoiceTerminal(invoice: Invoice): boolean {
  return isInvoicePaid(invoice) || invoice.status === 'expired' || invoice.status === 'canceled';
}

/** Verified on a live delivered order (2026-06-12): the code is `redemption_info.code`. */
export function extractRedemptionCode(order: BitrefillOrder): string | undefined {
  return order.redemption_info?.code ?? order.code ?? order.pin ?? order.redemption_info?.pin;
}

export function extractRedemptionLink(order: BitrefillOrder): string | undefined {
  return order.redemption_info?.link ?? order.link;
}
