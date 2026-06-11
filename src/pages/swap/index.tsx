import { ConnectWalletButton, NetworkBanner, useIsOnBase } from '@features/connect-wallet';
import { DemoToggle } from '@features/demo-mode';
import { PurchaseHistory } from '@features/purchase-history';
import { type FlowStatus, useSwapFlowStore } from '@shared/lib/swap-flow';
import { Card, CardContent } from '@shared/ui';
import { CheckoutStatus } from '@widgets/checkout-status';
import { RedemptionCard } from '@widgets/redemption-card';
import { SwapCard } from '@widgets/swap-card';
import { useEffect } from 'react';
import { useAccount } from 'wagmi';

const EXECUTION_STATUSES: FlowStatus[] = [
  'creating_invoice',
  'approving',
  'swapping',
  'paying',
  'polling_invoice',
  'failed',
];

/** Screen-reader announcements for phase changes. */
const STATUS_ANNOUNCEMENTS: Record<FlowStatus, string> = {
  idle: '',
  selecting: 'Choose a token and gift card amount',
  quoting: 'Fetching a price quote',
  review: 'Review your purchase',
  creating_invoice: 'Creating your invoice',
  approving: 'Waiting for token approval in your wallet',
  swapping: 'Swapping to USDC',
  paying: 'Paying the invoice',
  polling_invoice: 'Waiting for payment confirmation',
  success: 'Payment confirmed, your gift card code is ready',
  failed: 'Something went wrong',
};

function ConnectPrompt() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <img src="/bitrefill-logo.png" alt="" className="h-12 w-12 rounded-lg" />
        <div>
          <p className="font-medium">Connect your wallet to get started</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Swap any token you hold on Base for a Bitrefill Balance gift card — without leaving this
            page.
          </p>
        </div>
        <ConnectWalletButton />
      </CardContent>
    </Card>
  );
}

export function SwapPage() {
  const { isConnected } = useAccount();
  const onBase = useIsOnBase();
  const status = useSwapFlowStore((s) => s.phase.status);
  const beginSelecting = useSwapFlowStore((s) => s.beginSelecting);

  // The flow starts as soon as the user can act on it.
  useEffect(() => {
    if (isConnected && onBase && status === 'idle') beginSelecting();
  }, [isConnected, onBase, status, beginSelecting]);

  const executing = EXECUTION_STATUSES.includes(status);
  const blocked = isConnected && !onBase;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <img src="/bitrefill-logo.png" alt="" className="h-6 w-6 rounded-md" />
          Bitrefill Swap
          <DemoToggle />
        </h1>
        <ConnectWalletButton />
      </header>

      <NetworkBanner />

      <p aria-live="polite" className="sr-only">
        {STATUS_ANNOUNCEMENTS[status]}
      </p>

      {!isConnected && <ConnectPrompt />}
      {isConnected &&
        !blocked &&
        (status === 'success' ? <RedemptionCard /> : executing ? <CheckoutStatus /> : <SwapCard />)}
      {isConnected && !blocked && (status === 'idle' || status === 'selecting') && (
        <PurchaseHistory />
      )}

      <footer className="mt-auto pt-6 text-center text-muted-foreground text-xs">
        Settles in USDC on Base · Powered by Uniswap and Bitrefill
      </footer>
    </main>
  );
}
