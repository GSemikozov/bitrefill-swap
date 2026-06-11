import { formatUnits } from 'viem';

/** "1234.5678…" → "1,234.5678" with at most `maxFractionDigits` shown. */
export function formatTokenAmount(amount: bigint, decimals: number, maxFractionDigits = 6): string {
  const raw = formatUnits(amount, decimals);
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  if (value !== 0 && Math.abs(value) < 10 ** -maxFractionDigits) {
    return `<${(10 ** -maxFractionDigits).toFixed(maxFractionDigits)}`;
  }
  return value.toLocaleString('en-US', {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

/** USDC base units (6 decimals) → "$10.50". */
export function formatUsdcBaseUnits(baseUnits: number | bigint): string {
  return formatUsd(Number(baseUnits) / 1e6);
}

/** "0.0042 ETH per USDC"-style display rate from a quote's amounts. */
export function formatRate(
  inputAmount: bigint,
  inputDecimals: number,
  inputSymbol: string,
  outputAmount: bigint,
  outputDecimals: number,
  outputSymbol: string
): string {
  const input = Number(formatUnits(inputAmount, inputDecimals));
  const output = Number(formatUnits(outputAmount, outputDecimals));
  if (input === 0 || output === 0) return '—';
  const rate = output / input;
  return `1 ${inputSymbol} ≈ ${rate.toLocaleString('en-US', { maximumFractionDigits: rate < 1 ? 6 : 2 })} ${outputSymbol}`;
}
