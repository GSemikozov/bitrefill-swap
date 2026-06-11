import { describe, expect, it } from 'vitest';
import {
  balanceInvoiceResponseFixture,
  deliveredOrderResponseFixture,
  invoiceResponseFixture,
  orderResponseFixture,
  productResponseFixture,
} from '@/test/fixtures/bitrefill';
import {
  buildInvoicePayload,
  extractRedemptionCode,
  extractRedemptionLink,
  isInvoicePaid,
  isInvoiceTerminal,
} from './client';
import { invoiceResponseSchema, orderResponseSchema, productResponseSchema } from './schemas';

describe('bitrefill schemas (v2 fixtures)', () => {
  it('parses the product response and exposes USD denominations', () => {
    const parsed = productResponseSchema.parse(productResponseFixture);
    expect(parsed.data.id).toBe('test-gift-card-code');
    expect(parsed.data.packages.map((p) => p.amount)).toEqual([10, 20, 100]);
    expect(parsed.data.range.step).toBe(10);
  });

  it('parses the invoice response with payment in USDC base units', () => {
    const parsed = invoiceResponseSchema.parse(invoiceResponseFixture);
    expect(parsed.data.payment.price).toBe(10_500_000);
    expect(parsed.data.payment.address).toMatch(/^0x/);
    expect(parsed.data.orders[0]?.id).toBeTruthy();
  });

  it('parses a balance-paid (demo) invoice whose payment has no address', () => {
    const parsed = invoiceResponseSchema.parse(balanceInvoiceResponseFixture);
    expect(parsed.data.payment.method).toBe('balance');
    expect(parsed.data.payment.address).toBeUndefined();
  });

  it('rejects an invoice without payment details', () => {
    const broken = {
      ...invoiceResponseFixture,
      data: { ...invoiceResponseFixture.data, payment: undefined },
    };
    expect(invoiceResponseSchema.safeParse(broken).success).toBe(false);
  });

  it('parses a pre-delivery order (no redemption code yet)', () => {
    const parsed = orderResponseSchema.parse(orderResponseFixture);
    expect(extractRedemptionCode(parsed.data)).toBeUndefined();
  });

  it('extracts the code from a real delivered order (redemption_info.code)', () => {
    const parsed = orderResponseSchema.parse(deliveredOrderResponseFixture);
    expect(extractRedemptionCode(parsed.data)).toBe('7979451508286322');
    // The live shape carries no link — extraction degrades to undefined.
    expect(extractRedemptionLink(parsed.data)).toBeUndefined();
  });
});

describe('buildInvoicePayload', () => {
  const params = { value: 10, refundAddress: '0xdEaD' };

  it('uses usdc_base with a refund address by default', () => {
    expect(buildInvoicePayload(params, false)).toEqual({
      products: [{ product_id: 'test-gift-card-code', value: 10 }],
      payment_method: 'usdc_base',
      refund_address: '0xdEaD',
    });
  });

  it('switches to auto-paid balance in demo mode (no refund address)', () => {
    expect(buildInvoicePayload(params, true)).toEqual({
      products: [{ product_id: 'test-gift-card-code', value: 10 }],
      payment_method: 'balance',
      auto_pay: true,
    });
  });
});

describe('invoice status helpers', () => {
  const base = invoiceResponseFixture.data;

  it('treats payment_received, complete and all_delivered as paid', () => {
    expect(isInvoicePaid({ ...base, status: 'payment_received' })).toBe(true);
    expect(isInvoicePaid({ ...base, status: 'complete' })).toBe(true);
    // Observed on a live paid invoice (2026-06-12) — the PDF only mentions the first two.
    expect(isInvoicePaid({ ...base, status: 'all_delivered' })).toBe(true);
    expect(isInvoicePaid({ ...base, status: 'not_delivered' })).toBe(false);
  });

  it('falls back to payment.status complete', () => {
    expect(
      isInvoicePaid({
        ...base,
        status: 'something_new',
        payment: { ...base.payment, status: 'complete' },
      })
    ).toBe(true);
  });

  it('treats expiry as terminal but not paid', () => {
    expect(isInvoiceTerminal({ ...base, status: 'expired' })).toBe(true);
    expect(isInvoicePaid({ ...base, status: 'expired' })).toBe(false);
    expect(isInvoiceTerminal({ ...base, status: 'not_delivered' })).toBe(false);
  });
});
