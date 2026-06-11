import { TokenRow, toSelectedToken, useHeldTokens } from '@entities/token';
import type { DiscoveredToken } from '@shared/api/tokens';
import { useSwapFlowStore } from '@shared/lib/swap-flow';
import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Skeleton,
} from '@shared/ui';
import { useAccount } from 'wagmi';

interface TokenSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TokenListSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-2" role="status" aria-label="Loading balances">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function TokenSelectDialog({ open, onOpenChange }: TokenSelectDialogProps) {
  const { address } = useAccount();
  const { data: tokens, isLoading, isError, refetch } = useHeldTokens(address);
  const setToken = useSwapFlowStore((s) => s.setToken);

  function handleSelect(token: DiscoveredToken) {
    setToken(toSelectedToken(token));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Select a token</DialogTitle>
        <DialogDescription className="sr-only">
          Tokens you hold on Base, searchable by name or symbol
        </DialogDescription>
        <Command>
          <CommandInput placeholder="Search by name or symbol…" autoFocus />
          <CommandList>
            {isLoading && <TokenListSkeleton />}
            {isError && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-muted-foreground text-sm">Couldn't load your balances.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            )}
            {!isLoading && !isError && (
              <>
                <CommandEmpty>No tokens with balance on Base.</CommandEmpty>
                {tokens?.map((token) => (
                  <CommandItem
                    key={token.address}
                    value={`${token.symbol} ${token.name}`}
                    onSelect={() => handleSelect(token)}
                  >
                    <TokenRow token={token} />
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
