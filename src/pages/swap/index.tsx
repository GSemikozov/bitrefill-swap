import { type FlowStatus, useSwapFlowStore } from '@entities/swap-flow';
import { ConnectWalletButton, NetworkBanner, useIsOnBase } from '@features/connect-wallet';
import { DemoToggle } from '@features/demo-mode';
import { PurchaseHistory } from '@features/purchase-history';
import { Card, CardContent } from '@shared/ui';
import { CheckoutStatus } from '@widgets/checkout-status';
import { RedemptionCard } from '@widgets/redemption-card';
import { SwapCard } from '@widgets/swap-card';
import { Wallet } from 'lucide-react';
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
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" aria-hidden />
        </div>
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

type View = 'connect' | 'blocked' | 'success' | 'executing' | 'select';

/**
 * Coarse "which card is on screen". Doubles as the wrapper key so a phase
 * change remounts it and the new card fades in instead of snapping.
 */
function currentView(s: {
  isConnected: boolean;
  blocked: boolean;
  status: FlowStatus;
  executing: boolean;
}): View {
  if (!s.isConnected) return 'connect';
  if (s.blocked) return 'blocked';
  if (s.status === 'success') return 'success';
  return s.executing ? 'executing' : 'select';
}

/** The single card for the current phase (network banner handles `blocked`). */
function PhaseCard({ view }: { view: View }) {
  switch (view) {
    case 'connect':
      return <ConnectPrompt />;
    case 'success':
      return <RedemptionCard />;
    case 'executing':
      return <CheckoutStatus />;
    case 'select':
      return <SwapCard />;
    default:
      return null;
  }
}

export function SwapPage() {
  const { isConnected } = useAccount();
  const onBase = useIsOnBase();
  const status = useSwapFlowStore((s) => s.phase.status);
  const beginSelecting = useSwapFlowStore((s) => s.beginSelecting);

  useEffect(() => {
    if (isConnected && onBase && status === 'idle') beginSelecting();
  }, [isConnected, onBase, status, beginSelecting]);

  const executing = EXECUTION_STATUSES.includes(status);
  const blocked = isConnected && !onBase;
  const view = currentView({ isConnected, blocked, status, executing });

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-4 px-4 py-6 sm:py-10 md:max-w-md">
      <header className="flex items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 font-semibold text-lg tracking-tight">
          <img src="/bitrefill-logo.png" alt="" className="h-6 w-6 shrink-0 rounded-md" />
          <span className="truncate">Bitrefill Swap</span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <DemoToggle />
          <ConnectWalletButton collapseLabel />
        </div>
      </header>

      <NetworkBanner />

      <p aria-live="polite" className="sr-only">
        {STATUS_ANNOUNCEMENTS[status]}
      </p>

      <div key={view} className="flex flex-col gap-4 duration-200 animate-in fade-in-0">
        <PhaseCard view={view} />
        {view === 'select' && <PurchaseHistory />}
      </div>

      <footer className="mt-auto pt-6 text-center text-muted-foreground text-xs">
        Settles in USDC on Base · Powered by Uniswap and Bitrefill
      </footer>
    </main>
  );
}
