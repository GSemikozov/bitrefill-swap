import type { SelectedToken } from '@entities/token';
import { isUsdc } from '@entities/token';
import { QUERY_KEYS } from '@shared/api/query-keys';
import { fetchSwapQuote } from '@shared/api/uniswap';
import {
  QUOTE_TTL_MS,
  USDC_DECIMALS,
  USDC_PRICE_PREMIUM_ESTIMATE,
  useIsDemoPayment,
} from '@shared/config';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

export interface SwapEstimate {
  /** Estimated USDC the invoice will require, base units. */
  usdcOut: bigint;
  /** Expected input in the selected token's base units (equals usdcOut for USDC). */
  inputAmount: bigint;
  /** Worst-case input after slippage — balance checks use this. */
  maxInputAmount: bigint;
  priceImpact?: number;
  gasFeeUsd?: number;
  /** True when no swap is needed (paying directly in USDC). */
  usdcDirect: boolean;
  /** Demo mode: nothing is paid on-chain at all. */
  demo: boolean;
}

function estimateUsdcOut(denominationUsd: number): bigint {
  return BigInt(Math.round(denominationUsd * USDC_PRICE_PREMIUM_ESTIMATE * 10 ** USDC_DECIMALS));
}

/**
 * Pre-invoice estimate: denomination → estimated USDC → Uniswap EXACT_OUTPUT
 * quote for the selected token. Auto-refreshes every QUOTE_TTL so the review
 * screen never shows a stale price; `dataUpdatedAt` drives the countdown.
 */
export function useSwapEstimate(
  token: SelectedToken | null,
  denomination: number | null,
  swapper: Address | undefined,
  enabled = true
) {
  const demo = useIsDemoPayment();
  const usdcDirect = token ? isUsdc(token.address) : false;
  const usdcOut = denomination ? estimateUsdcOut(denomination) : 0n;
  const skipQuote = usdcDirect || demo;

  const query = useQuery({
    queryKey: QUERY_KEYS.uniswap.quote(token?.address, usdcOut.toString()),
    queryFn: async (): Promise<SwapEstimate> => {
      if (!token || !swapper) throw new Error('Missing token or wallet');
      const response = await fetchSwapQuote({
        swapper,
        tokenIn: token.address,
        amountOut: usdcOut.toString(),
      });
      // The API flips numeric fields between number and string — convert at
      // read time only (the raw quote must stay untouched for /swap).
      const asNumber = (value: number | string | undefined) =>
        value === undefined ? undefined : Number(value);
      return {
        usdcOut,
        inputAmount: BigInt(response.quote.input.amount),
        maxInputAmount: BigInt(response.quote.input.maximumAmount ?? response.quote.input.amount),
        priceImpact: asNumber(response.quote.priceImpact),
        gasFeeUsd: asNumber(response.quote.gasFeeUSD),
        usdcDirect: false,
        demo: false,
      };
    },
    enabled: enabled && !skipQuote && Boolean(token && denomination && swapper),
    staleTime: QUOTE_TTL_MS,
    refetchInterval: QUOTE_TTL_MS,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  if (skipQuote && denomination) {
    const direct: SwapEstimate = {
      usdcOut,
      inputAmount: usdcOut,
      maxInputAmount: usdcOut,
      usdcDirect,
      demo,
    };
    return {
      estimate: direct,
      isLoading: false,
      isError: false as const,
      error: null,
      dataUpdatedAt: 0,
      refetch: () => {},
    };
  }

  return {
    estimate: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: () => query.refetch(),
  };
}
