import { mapExecutionError, useSwapFlowStore } from '@entities/swap-flow';
import { useExecutePurchase } from '@features/execute-swap';
import { useSwapEstimate } from '@features/get-quote';
import { DenominationForm } from '@features/select-denomination';
import { TokenSelectDialog } from '@features/select-token';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@shared/ui';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ReviewPanel } from './ui/review-panel';
import { TokenTrigger } from './ui/token-trigger';

/** Token + amount selection and the pre-purchase review. */
export function SwapCard() {
  const { address } = useAccount();
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);

  const phase = useSwapFlowStore((s) => s.phase);
  const token = useSwapFlowStore((s) => s.token);
  const denomination = useSwapFlowStore((s) => s.denomination);
  const quoteReady = useSwapFlowStore((s) => s.quoteReady);
  const backToEdit = useSwapFlowStore((s) => s.backToEdit);
  const fail = useSwapFlowStore((s) => s.fail);

  const { estimate, isError, error, dataUpdatedAt } = useSwapEstimate(
    token,
    denomination,
    address,
    phase.status === 'selecting' || phase.status === 'quoting' || phase.status === 'review'
  );

  const { start } = useExecutePurchase();

  // quoting is a real waiting state: leave it as soon as the estimate settles.
  useEffect(() => {
    if (phase.status !== 'quoting') return;
    if (estimate) {
      quoteReady();
    } else if (isError) {
      const mapped = mapExecutionError(error);
      fail('quote', mapped.reason, mapped.message);
    }
  }, [phase.status, estimate, isError, error, quoteReady, fail]);

  const inReview = phase.status === 'review' && token && denomination && estimate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{inReview ? 'Review your purchase' : 'Get a gift card'}</CardTitle>
        <CardDescription>
          {inReview
            ? 'Check the numbers — the swap starts after you confirm.'
            : 'Swap any token you hold on Base for a Bitrefill Balance card.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {phase.status === 'quoting' && (
          <div className="flex flex-col gap-3" role="status" aria-label="Preparing quote">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {(phase.status === 'idle' || phase.status === 'selecting') && (
          <div className="flex flex-col gap-4">
            <TokenTrigger token={token} onClick={() => setTokenDialogOpen(true)} />
            <DenominationForm />
          </div>
        )}

        {inReview && (
          <ReviewPanel
            token={token}
            denomination={denomination}
            estimate={estimate}
            quoteUpdatedAt={dataUpdatedAt}
            onConfirm={start}
            onBack={backToEdit}
            confirming={false}
          />
        )}
      </CardContent>
      <TokenSelectDialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen} />
    </Card>
  );
}
