import type { DiscoveredToken } from '@shared/api/tokens';
import { tokenValueUsd } from '@shared/api/tokens';
import { formatTokenAmount, formatUsd } from '@shared/lib';

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

export function TokenRow({ token }: { token: DiscoveredToken }) {
  const value = tokenValueUsd(token);
  return (
    <div className="flex w-full items-center gap-3">
      <TokenLogo token={token} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{token.symbol}</div>
        <div className="truncate text-muted-foreground text-xs">{token.name}</div>
      </div>
      <div className="text-right">
        <div className="font-medium tabular-nums">
          {formatTokenAmount(token.balance, token.decimals)}
        </div>
        {value !== undefined && (
          <div className="text-muted-foreground text-xs tabular-nums">{formatUsd(value)}</div>
        )}
      </div>
    </div>
  );
}
