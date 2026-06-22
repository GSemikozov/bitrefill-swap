import { useSwapFlowStore } from '@entities/swap-flow';
import { isUsdc } from '@entities/token';
import { useExecutePurchase } from '@features/execute-swap';
import { useInvoiceStatusSync } from '@features/poll-invoice';
import { useIsDemoPayment } from '@shared/config';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui';
import { useEffect, useState } from 'react';
import { buildSteps } from './model/steps';
import { StepIndicator } from './ui/step-indicator';

function FailurePanel() {
  const phase = useSwapFlowStore((s) => s.phase);
  const reset = useSwapFlowStore((s) => s.reset);
  const { retry } = useExecutePurchase();

  if (phase.status !== 'failed') return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
    >
      <p className="text-sm">{phase.message}</p>
      <div className="flex gap-2">
        {phase.recoverable ? (
          <>
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel purchase
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={reset}>
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}

function SlowPollingNotice() {
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
      <p className="font-medium">Taking longer than usual</p>
      <p className="mt-1 text-muted-foreground">
        Your payment was sent and the invoice is still being confirmed. It's safe to keep this tab
        open — or reload anytime; the purchase resumes right where it left off.
      </p>
    </div>
  );
}

/**
 * Some wallets close their prompt without rejecting the request, leaving the
 * await hanging silently — after a while, tell the user how to recover
 * (reload resumes the purchase via the persisted flow state).
 */
function WalletStuckHint({ waiting }: { waiting: boolean }) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!waiting) {
      setStuck(false);
      return;
    }
    const timer = setTimeout(() => setStuck(true), 30_000);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (!waiting || !stuck) return null;

  return (
    <p className="text-muted-foreground text-xs">
      No prompt in your wallet? Open the wallet extension manually — or reload this page, your
      purchase resumes right where it stopped.
    </p>
  );
}

/** Vertical execution progress: invoice → (approve) → (swap) → pay → confirm. */
export function CheckoutStatus() {
  const phase = useSwapFlowStore((s) => s.phase);
  const token = useSwapFlowStore((s) => s.token);
  const invoiceId = useSwapFlowStore((s) => s.invoiceId);
  const approveTxHash = useSwapFlowStore((s) => s.approveTxHash);
  const swapTxHash = useSwapFlowStore((s) => s.swapTxHash);
  const payTxHash = useSwapFlowStore((s) => s.payTxHash);

  const { softTimedOut, paid } = useInvoiceStatusSync();

  const demo = useIsDemoPayment();
  const steps = buildSteps({
    phaseStatus: paid ? 'success' : phase.status,
    failedStep: phase.status === 'failed' ? phase.step : undefined,
    usdcDirect: demo || (token ? isUsdc(token.address) : false),
    invoiceId,
    approveTxHash,
    swapTxHash,
    payTxHash,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completing your purchase</CardTitle>
        <CardDescription>
          {demo
            ? 'Demo mode — the invoice pays itself, no wallet prompts will appear.'
            : "Keep this tab open — we'll walk through each step with your wallet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StepIndicator steps={steps} />
        <WalletStuckHint waiting={steps.some((step) => step.state === 'wallet')} />
        {softTimedOut && phase.status === 'polling_invoice' && invoiceId && <SlowPollingNotice />}
        <FailurePanel />
      </CardContent>
    </Card>
  );
}
