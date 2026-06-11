import { CodePanel, useOrder } from '@entities/invoice';
import { extractRedemptionLink } from '@shared/api/bitrefill';
import { isDemoPayment } from '@shared/config';
import { recordPurchase } from '@shared/lib/purchase-history';
import { useSwapFlowStore } from '@shared/lib/swap-flow';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@shared/ui';
import { ExternalLink, PartyPopper } from 'lucide-react';
import { useEffect } from 'react';
import { useAccount } from 'wagmi';

/** Success screen: persists (sessionStorage) until the user starts a new swap. */
export function RedemptionCard() {
  const { address } = useAccount();
  const phase = useSwapFlowStore((s) => s.phase);
  const orderId = useSwapFlowStore((s) => s.orderId);
  const invoiceId = useSwapFlowStore((s) => s.invoiceId);
  const denomination = useSwapFlowStore((s) => s.denomination);
  const swapTxHash = useSwapFlowStore((s) => s.swapTxHash);
  const payTxHash = useSwapFlowStore((s) => s.payTxHash);
  const reset = useSwapFlowStore((s) => s.reset);

  const { order, redemptionCode, isLoading, isError, refetch } = useOrder(
    orderId,
    phase.status === 'success'
  );

  // Durable history (ids only — the code is re-fetchable): without this the
  // code would be unreachable from the UI after "Start a new swap".
  useEffect(() => {
    if (phase.status !== 'success' || !orderId || !invoiceId || !address || !denomination) return;
    recordPurchase({
      orderId,
      invoiceId,
      denomination,
      address,
      completedAt: new Date().toISOString(),
      swapTxHash: swapTxHash ?? undefined,
      payTxHash: payTxHash ?? undefined,
      demo: isDemoPayment(),
    });
  }, [phase.status, orderId, invoiceId, address, denomination, swapTxHash, payTxHash]);

  const link = order ? extractRedemptionLink(order) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-success" aria-hidden />
          Payment confirmed
        </CardTitle>
        <CardDescription>
          Your {denomination ? `$${denomination} ` : ''}Bitrefill Balance card is ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {redemptionCode ? (
          <CodePanel code={redemptionCode} />
        ) : isError ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p>
              Couldn't load the code, but your order is safe — retry below or find it later with the
              order id.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-2" role="status" aria-label="Waiting for redemption code">
            <Skeleton className="h-16 w-full" />
            {!isLoading && (
              <p className="text-muted-foreground text-xs">Waiting for the code to be issued…</p>
            )}
          </div>
        )}

        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
          >
            Redemption instructions
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}

        <dl className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 whitespace-nowrap text-muted-foreground">Order id</dt>
            <dd className="min-w-0 flex-1 select-all break-all text-right font-mono">{orderId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 whitespace-nowrap text-muted-foreground">Invoice id</dt>
            <dd className="min-w-0 flex-1 select-all break-all text-right font-mono">
              {invoiceId}
            </dd>
          </div>
        </dl>

        <Button variant="outline" onClick={reset}>
          Start a new swap
        </Button>
      </CardContent>
    </Card>
  );
}
