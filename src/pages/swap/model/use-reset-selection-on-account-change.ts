import { useSwapFlowStore } from '@entities/swap-flow';
import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';

/**
 * Resets the picked token when the connected wallet actually switches (A→B, or
 * disconnect→a different wallet) — the selection belongs to the previous
 * account. The first connect and reloads that restore the same address are left
 * alone so a resumed session keeps its selection.
 */
export function useResetSelectionOnAccountChange() {
  const { address } = useAccount();
  const clearSelection = useSwapFlowStore((s) => s.clearSelection);
  const lastAddress = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!address) return;
    const prev = lastAddress.current;
    lastAddress.current = address;
    if (prev && prev !== address) clearSelection();
  }, [address, clearSelection]);
}
