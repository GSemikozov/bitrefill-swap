import { explorerTxUrl } from '@shared/config';
import { cn } from '@shared/lib';
import { Check, CircleAlert, ExternalLink, Loader2, Wallet } from 'lucide-react';
import type { StepView } from '../model/steps';

function StepIcon({ state }: { state: StepView['state'] }) {
  switch (state) {
    case 'done':
      return <Check className="h-4 w-4 text-success" aria-hidden />;
    case 'confirming':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />;
    case 'wallet':
      return <Wallet className="h-4 w-4 animate-pulse text-primary" aria-hidden />;
    case 'failed':
      return <CircleAlert className="h-4 w-4 text-destructive" aria-hidden />;
    default:
      return <span className="h-2 w-2 rounded-full bg-border" aria-hidden />;
  }
}

const STATE_HINT: Record<StepView['state'], string | null> = {
  pending: null,
  wallet: 'Confirm in your wallet',
  confirming: 'Confirming…',
  done: 'Done',
  failed: 'Failed',
};

export function StepIndicator({ steps }: { steps: StepView[] }) {
  return (
    <ol className="flex flex-col" aria-label="Purchase progress">
      {steps.map((step, index) => {
        const active = step.state !== 'pending' && step.state !== 'done';
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                  step.state === 'done' && 'border-success/40 bg-success/10',
                  active && 'border-primary/40 bg-primary/10',
                  step.state === 'failed' && 'border-destructive/40 bg-destructive/10',
                  step.state === 'pending' && 'border-border'
                )}
              >
                <StepIcon state={step.state} />
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-px flex-1',
                    step.state === 'done' ? 'bg-success/40' : 'bg-border'
                  )}
                  aria-hidden
                />
              )}
            </div>
            <div className={cn('flex-1 pb-5', step.state === 'pending' && 'opacity-60')}>
              <p className="font-medium text-sm leading-8">{step.label}</p>
              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                {STATE_HINT[step.state] && <span>{STATE_HINT[step.state]}</span>}
                {step.txHash && (
                  <a
                    href={explorerTxUrl(step.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View on BaseScan
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
