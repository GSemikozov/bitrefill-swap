import { describe, expect, it } from 'vitest';
import {
  approvalNeededResponseFixture,
  approvalNotNeededResponseFixture,
  quoteResponseFixture,
  swapResponseFixture,
} from '@/test/fixtures/uniswap';
import { approvalCheckResponseSchema, quoteResponseSchema, swapResponseSchema } from './schemas';

describe('uniswap trading api schemas (live fixtures)', () => {
  it('parses an EXACT_OUTPUT quote and keeps unknown fields for the /swap round-trip', () => {
    const parsed = quoteResponseSchema.parse(quoteResponseFixture);
    expect(parsed.quote.input.maximumAmount).toBe('6406276307183452');
    expect(parsed.quote.output.amount).toBe('10500000');
    expect(parsed.quote.priceImpact).toBe(0.02);
    // Loose parsing must preserve fields we do not model (passed back verbatim).
    expect((parsed.quote as Record<string, unknown>).routeString).toBe('ETH → USDC');
    expect((parsed.quote as Record<string, unknown>).quoteId).toBeTruthy();
  });

  it('round-trips the quote without mutating a single value (live /swap rejects any change)', () => {
    const parsed = quoteResponseSchema.parse(quoteResponseFixture);
    // toEqual is type-strict: a coerced "0.0055…" string→number would fail here.
    expect(parsed.quote).toEqual(quoteResponseFixture.quote);
    expect(parsed.quote.gasFeeUSD).toBe('0.005521526219012081');
  });

  it('parses approval responses with and without a required transaction', () => {
    const needed = approvalCheckResponseSchema.parse(approvalNeededResponseFixture);
    expect(needed.approval?.to).toBe('0x4200000000000000000000000000000000000006');

    const notNeeded = approvalCheckResponseSchema.parse(approvalNotNeededResponseFixture);
    expect(notNeeded.approval).toBeNull();
  });

  it('parses the swap response, coercing the string chainId', () => {
    const parsed = swapResponseSchema.parse(swapResponseFixture);
    expect(parsed.swap.chainId).toBe(8453);
    expect(parsed.swap.value).toBe('0x16c2796f9f675c');
    expect(parsed.swap.gasLimit).toBe('555282');
  });

  it('rejects a swap response without calldata', () => {
    const broken = { requestId: 'x', swap: { to: '0x1', from: '0x2' } };
    expect(swapResponseSchema.safeParse(broken).success).toBe(false);
  });
});
