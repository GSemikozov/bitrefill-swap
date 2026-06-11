import { describe, expect, it } from 'vitest';
import { formatRate, formatTokenAmount, formatUsd, formatUsdcBaseUnits } from './format';

describe('formatTokenAmount', () => {
  it('formats with thousands separators and capped fraction digits', () => {
    expect(formatTokenAmount(1_234_567_890n, 6)).toBe('1,234.56789');
    expect(formatTokenAmount(1_000_000n, 6)).toBe('1');
  });

  it('shows a floor marker for sub-precision dust instead of "0"', () => {
    expect(formatTokenAmount(1n, 18)).toBe('<0.000001');
  });

  it('handles zero and full-precision wei values', () => {
    expect(formatTokenAmount(0n, 18)).toBe('0');
    expect(formatTokenAmount(6_374_404_285_754_679n, 18, 6)).toBe('0.006374');
  });
});

describe('formatUsd / formatUsdcBaseUnits', () => {
  it('formats USD currency', () => {
    expect(formatUsd(10)).toBe('$10.00');
    expect(formatUsd(1234.567)).toBe('$1,234.57');
  });

  it('converts USDC base units (6 decimals)', () => {
    expect(formatUsdcBaseUnits(10_500_000)).toBe('$10.50');
    expect(formatUsdcBaseUnits(10_500_000n)).toBe('$10.50');
  });
});

describe('formatRate', () => {
  it('derives a per-token rate', () => {
    // 0.005 ETH → 10.5 USDC ⇒ 1 ETH ≈ 2100 USDC
    expect(formatRate(5_000_000_000_000_000n, 18, 'ETH', 10_500_000n, 6, 'USDC')).toBe(
      '1 ETH ≈ 2,100 USDC'
    );
  });

  it('falls back on zero amounts', () => {
    expect(formatRate(0n, 18, 'ETH', 10_500_000n, 6, 'USDC')).toBe('—');
  });
});
