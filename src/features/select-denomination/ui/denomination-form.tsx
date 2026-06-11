import { useGiftCardProduct } from '@entities/gift-card';
import { useHeldTokens } from '@entities/token';
import { type SwapEstimate, useSwapEstimate } from '@features/get-quote';
import { zodResolver } from '@hookform/resolvers/zod';
import { NATIVE_TOKEN_ADDRESS } from '@shared/config';
import { cn, formatTokenAmount, formatUsd, formatUsdcBaseUnits } from '@shared/lib';
import { useSwapFlowStore } from '@shared/lib/swap-flow';
import { Button, Skeleton } from '@shared/ui';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { parseEther } from 'viem';
import { useAccount } from 'wagmi';
import {
  type AffordabilityProblem,
  checkAffordability,
  createDenominationSchema,
  type DenominationFormValues,
} from '../model/schema';

/** Fallback native-gas reserve when the quote has no usable gas estimate. */
const DEFAULT_GAS_RESERVE = parseEther('0.0003');

function gasReserveFor(estimate: SwapEstimate, ethPriceUsd: number | undefined): bigint {
  if (estimate.gasFeeUsd && ethPriceUsd) {
    // Twice the quoted network fee, in wei — generous but not blocking.
    return BigInt(Math.round(((estimate.gasFeeUsd * 2) / ethPriceUsd) * 1e18));
  }
  return DEFAULT_GAS_RESERVE;
}

const PROBLEM_MESSAGES: Record<AffordabilityProblem, (symbol: string) => string> = {
  balance: (symbol) => `Not enough ${symbol} for this amount.`,
  gas: () => 'This would not leave enough ETH for network fees.',
};

function EstimateLine({
  estimate,
  isLoading,
  isError,
  symbol,
  decimals,
  problem,
}: {
  estimate: SwapEstimate | undefined;
  isLoading: boolean;
  isError: boolean;
  symbol: string;
  decimals: number;
  problem: AffordabilityProblem | null;
}) {
  if (isLoading) return <Skeleton className="h-4 w-48" />;
  if (isError) {
    return <p className="text-destructive text-sm">Couldn't estimate the price right now.</p>;
  }
  if (!estimate) return null;
  if (estimate.demo) {
    return (
      <p className="text-muted-foreground text-sm">
        Demo mode — the invoice pays itself from the Bitrefill test balance, nothing leaves your
        wallet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">
        ≈{' '}
        <span className="font-medium text-foreground tabular-nums">
          {formatTokenAmount(estimate.inputAmount, decimals)} {symbol}
        </span>{' '}
        for {formatUsdcBaseUnits(estimate.usdcOut)} in USDC{' '}
        <span title="Final price is fixed when the invoice is created">(estimate)</span>
      </p>
      {problem && <p className="text-destructive text-sm">{PROBLEM_MESSAGES[problem](symbol)}</p>}
    </div>
  );
}

export function DenominationForm() {
  const { address } = useAccount();
  const token = useSwapFlowStore((s) => s.token);
  const denomination = useSwapFlowStore((s) => s.denomination);
  const setDenomination = useSwapFlowStore((s) => s.setDenomination);
  const beginQuoting = useSwapFlowStore((s) => s.beginQuoting);

  const { denominations, isLoading: productLoading, usedFallback } = useGiftCardProduct();
  const { data: heldTokens } = useHeldTokens(address);
  const { estimate, isLoading, isError } = useSwapEstimate(token, denomination, address);

  const schema = useMemo(() => createDenominationSchema(denominations), [denominations]);

  const form = useForm<DenominationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: denomination ? { denomination } : undefined,
    mode: 'onChange',
  });

  const held = heldTokens?.find((t) => t.address === token?.address);
  const balanceUsd =
    held?.priceUsd !== undefined
      ? (Number(held.balance) / 10 ** held.decimals) * held.priceUsd
      : undefined;
  const ethPriceUsd = heldTokens?.find((t) => t.address === NATIVE_TOKEN_ADDRESS)?.priceUsd;

  // Demo mode pays nothing on-chain — balance checks would only mislead.
  const problem =
    estimate && held && !estimate.demo
      ? checkAffordability({
          balance: held.balance,
          maxInput: estimate.maxInputAmount,
          isNative: held.address === NATIVE_TOKEN_ADDRESS,
          gasReserve: gasReserveFor(estimate, ethPriceUsd),
        })
      : null;

  function pick(value: number) {
    form.setValue('denomination', value, { shouldValidate: true });
    setDenomination(value);
  }

  const canReview = Boolean(token && denomination && estimate && !problem && !isError);

  return (
    <form
      onSubmit={form.handleSubmit(() => beginQuoting())}
      className="flex flex-col gap-4"
      aria-label="Gift card amount"
    >
      <div>
        <p className="mb-2 font-medium text-sm">Gift card amount (USD)</p>
        {productLoading ? (
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-16 rounded-md" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Denominations">
            {denominations.map((value) => {
              const unaffordable =
                !estimate?.demo && balanceUsd !== undefined && value > balanceUsd;
              return (
                <Button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={denomination === value}
                  variant={denomination === value ? 'default' : 'outline'}
                  className={cn('min-w-16', unaffordable && 'opacity-50')}
                  disabled={unaffordable}
                  title={unaffordable ? 'Exceeds your balance for this token' : undefined}
                  onClick={() => pick(value)}
                >
                  {formatUsd(value)}
                </Button>
              );
            })}
          </div>
        )}
        {usedFallback && (
          <p className="mt-2 text-muted-foreground text-xs">
            Showing standard amounts — live prices unavailable.
          </p>
        )}
        {form.formState.errors.denomination && (
          <p className="mt-2 text-destructive text-sm" role="alert">
            {form.formState.errors.denomination.message}
          </p>
        )}
      </div>

      {token && denomination && (
        <EstimateLine
          estimate={estimate}
          isLoading={isLoading}
          isError={isError}
          symbol={token.symbol}
          decimals={token.decimals}
          problem={problem}
        />
      )}

      <Button type="submit" size="lg" disabled={!canReview}>
        Review purchase
      </Button>
    </form>
  );
}
