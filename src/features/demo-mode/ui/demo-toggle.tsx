import { useSwapFlowStore } from '@entities/swap-flow';
import { setDemoPayment, useIsDemoPayment } from '@shared/config';
import { cn } from '@shared/lib';
import { FlaskConical } from 'lucide-react';

/**
 * Runtime demo-mode switch. Flips a reactive store (no page reload — that would
 * remount the wallet providers and flicker the UI) and resets the swap flow so
 * a selection made under the other mode can't linger. Only switchable before a
 * purchase starts; the store is the source of truth read by API clients too.
 */
export function DemoToggle() {
  const status = useSwapFlowStore((s) => s.phase.status);
  const reset = useSwapFlowStore((s) => s.reset);
  const demo = useIsDemoPayment();
  // Mode changes data-fetching semantics (token list, quoting), so only allow
  // it before a purchase is in motion.
  const locked = status !== 'idle' && status !== 'selecting';

  function toggle() {
    setDemoPayment(!demo);
    reset();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={locked}
      aria-pressed={demo}
      title={
        locked
          ? 'Finish or cancel the current purchase first'
          : demo
            ? 'Demo mode: invoices pay themselves, nothing on-chain. Click to switch to real payments.'
            : 'Try the full flow without spending anything'
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        demo
          ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <FlaskConical className="h-3 w-3 shrink-0" aria-hidden />
      {demo ? 'Demo on' : 'Try demo'}
    </button>
  );
}
