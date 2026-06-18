import type { SelectedToken } from '@entities/token';
import { Button } from '@shared/ui';
import { ChevronDown } from 'lucide-react';

interface TokenTriggerProps {
  token: SelectedToken | null;
  onClick: () => void;
}

export function TokenTrigger({ token, onClick }: TokenTriggerProps) {
  return (
    <div>
      <p className="mb-2 font-medium text-sm">You pay with</p>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={onClick}
        aria-haspopup="dialog"
      >
        {token ? (
          <span className="flex items-center gap-2">
            {token.logoUrl ? (
              <img src={token.logoUrl} alt="" className="h-5 w-5 rounded-full" />
            ) : (
              <span
                aria-hidden
                className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] text-muted-foreground"
              >
                {token.symbol.slice(0, 2)}
              </span>
            )}
            <span className="font-medium">{token.symbol}</span>
            <span className="text-muted-foreground text-xs">{token.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Select a token you hold</span>
        )}
        <ChevronDown className="text-muted-foreground" aria-hidden />
      </Button>
    </div>
  );
}
