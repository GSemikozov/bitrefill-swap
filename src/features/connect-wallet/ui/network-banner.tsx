import { BASE_CHAIN_ID } from '@shared/config';
import { Button } from '@shared/ui';
import { TriangleAlert } from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';

/** Blocks the flow until the wallet is on Base. Rendered above the swap card. */
export function NetworkBanner() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === BASE_CHAIN_ID) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4"
    >
      <TriangleAlert className="h-5 w-5 shrink-0 text-warning" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-medium">Wrong network</p>
        <p className="text-muted-foreground">This app works on Base only.</p>
      </div>
      <Button size="sm" loading={isPending} onClick={() => switchChain({ chainId: BASE_CHAIN_ID })}>
        Switch to Base
      </Button>
    </div>
  );
}

export function useIsOnBase(): boolean {
  const { chainId, isConnected } = useAccount();
  return isConnected && chainId === BASE_CHAIN_ID;
}
