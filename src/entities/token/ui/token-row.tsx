import type { DiscoveredToken } from '@shared/api/tokens';
import { tokenValueUsd } from '@shared/api/tokens';
import { cn, formatTokenAmount, formatUsd } from '@shared/lib';
import { Check } from 'lucide-react';

function TokenLogo({ token }: { token: DiscoveredToken }) {
  if (token.logoUrl) {
    return (
      <img
        src={token.logoUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full bg-muted"
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-muted-foreground text-xs"
    >
      {token.symbol.slice(0, 3).toUpperCase()}
    </div>
  );
}

export function TokenRow({ token, selected }: { token: DiscoveredToken; selected?: boolean }) {
  const value = tokenValueUsd(token);
  const zeroBalance = token.balance === 0n;
  return (
    <div className={cn('flex w-full items-center gap-3', zeroBalance && 'opacity-55')}>
      <TokenLogo token={token} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{token.symbol}</span>
          {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Selected" />}
        </div>
        <div className="truncate text-muted-foreground text-xs">{token.name}</div>
      </div>
      <div className="text-right">
        {zeroBalance ? (
          <div className="text-muted-foreground text-xs">No balance</div>
        ) : (
          <>
            <div className="font-medium tabular-nums">
              {formatTokenAmount(token.balance, token.decimals)}
            </div>
            {value !== undefined && (
              <div className="text-muted-foreground text-xs tabular-nums">{formatUsd(value)}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
