import { isDemoPayment, setDemoPayment } from '@shared/config';
import { cn } from '@shared/lib';
import { type FlowStatus, useSwapFlowStore } from '@shared/lib/swap-flow';
import { FlaskConical } from 'lucide-react';

/** Mid-purchase mode switches would orphan the flow — block them. */
const BUSY_STATUSES: FlowStatus[] = [
  'creating_invoice',
  'approving',
  'swapping',
  'paying',
  'polling_invoice',
];

/**
 * Runtime demo-mode switch. Reloads on toggle: the mode feeds non-reactive
 * modules (API clients, orchestrator), and a reload re-derives the flow state
 * safely — paid invoices and codes survive via sessionStorage.
 */
export function DemoToggle() {
  const status = useSwapFlowStore((s) => s.phase.status);
  const demo = isDemoPayment();
  const busy = BUSY_STATUSES.includes(status);

  function toggle() {
    setDemoPayment(!demo);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={demo}
      title={
        busy
          ? 'Finish or cancel the current purchase first'
          : demo
            ? 'Demo mode: invoices pay themselves, nothing on-chain. Click to switch to real payments.'
            : 'Try the full flow without spending anything'
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        demo
          ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      {demo ? 'Demo on' : 'Try demo'}
    </button>
  );
}
