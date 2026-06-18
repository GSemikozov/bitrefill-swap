import type { SelectedToken } from '@entities/token';
import { QuoteCountdown, type SwapEstimate } from '@features/get-quote';
import { USDC_DECIMALS } from '@shared/config';
import { formatRate, formatTokenAmount, formatUsd, formatUsdcBaseUnits } from '@shared/lib';
import { Button } from '@shared/ui';
import { ArrowDown } from 'lucide-react';

interface ReviewPanelProps {
  token: SelectedToken;
  denomination: number;
  estimate: SwapEstimate;
  quoteUpdatedAt: number;
  onConfirm: () => void;
  onBack: () => void;
  confirming: boolean;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function ReviewPanel({
  token,
  denomination,
  estimate,
  quoteUpdatedAt,
  onConfirm,
  onBack,
  confirming,
}: ReviewPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-secondary/50 p-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">You pay</p>
        {estimate.demo ? (
          <p className="font-semibold text-xl">Nothing — demo mode</p>
        ) : (
          <p className="font-semibold text-xl tabular-nums">
            {estimate.usdcDirect ? '' : '≈ '}
            {formatTokenAmount(estimate.inputAmount, token.decimals)} {token.symbol}
          </p>
        )}
        <ArrowDown className="my-2 h-4 w-4 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground text-xs uppercase tracking-wide">You get</p>
        <p className="font-semibold text-xl">{formatUsd(denomination)} Bitrefill Balance card</p>
      </div>

      <div className="flex flex-col gap-2">
        {!estimate.usdcDirect && !estimate.demo && (
          <>
            <DetailRow
              label="Rate"
              value={formatRate(
                estimate.inputAmount,
                token.decimals,
                token.symbol,
                estimate.usdcOut,
                USDC_DECIMALS,
                'USDC'
              )}
            />
            <DetailRow
              label="Maximum you'll spend"
              value={`${formatTokenAmount(estimate.maxInputAmount, token.decimals)} ${token.symbol}`}
            />
            {estimate.priceImpact !== undefined && (
              <DetailRow label="Price impact" value={`${estimate.priceImpact.toFixed(2)}%`} />
            )}
            {estimate.gasFeeUsd !== undefined && (
              <DetailRow label="Network fee (est.)" value={formatUsd(estimate.gasFeeUsd)} />
            )}
          </>
        )}
        <DetailRow label="Card price (est.)" value={formatUsdcBaseUnits(estimate.usdcOut)} />
        <p className="text-muted-foreground text-xs">
          {estimate.demo
            ? 'Demo mode: the invoice is paid from the Bitrefill test balance — no wallet transactions.'
            : 'The exact USDC price is fixed when the invoice is created in the next step.'}
        </p>
      </div>

      {!estimate.usdcDirect && <QuoteCountdown updatedAt={quoteUpdatedAt} />}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onBack}
          disabled={confirming}
        >
          Back
        </Button>
        <Button className="flex-1" size="lg" onClick={onConfirm} loading={confirming}>
          Confirm purchase
        </Button>
      </div>
    </div>
  );
}
