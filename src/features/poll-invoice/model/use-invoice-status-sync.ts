import { useInvoicePolling } from '@entities/invoice';
import { useSwapFlowStore } from '@entities/swap-flow';
import { isInvoicePaid, isInvoiceTerminal } from '@shared/api/bitrefill';
import { useEffect } from 'react';

/** Let the user see the final step turn green before the screen changes. */
const SUCCESS_PAUSE_MS = 1_600;

/**
 * Bridges invoice polling into the FSM: paid → success (after a short pause
 * so the completed steps register visually); dead invoice → unrecoverable
 * failure. Mounted while the checkout status is on screen.
 */
export function useInvoiceStatusSync() {
  const phaseStatus = useSwapFlowStore((s) => s.phase.status);
  const invoiceId = useSwapFlowStore((s) => s.invoiceId);
  const enabled = phaseStatus === 'polling_invoice';

  const polling = useInvoicePolling(invoiceId, enabled);
  const { invoice } = polling;

  const paid = Boolean(enabled && invoice && isInvoicePaid(invoice));

  useEffect(() => {
    if (!enabled || !invoice) return;
    const store = useSwapFlowStore.getState();
    if (isInvoicePaid(invoice)) {
      const timer = setTimeout(() => store.invoicePaid(), SUCCESS_PAUSE_MS);
      return () => clearTimeout(timer);
    }
    if (isInvoiceTerminal(invoice)) {
      store.fail(
        'poll',
        'api',
        'This invoice is no longer payable. Start a new purchase — any sent funds are refunded to your wallet.',
        false
      );
    }
  }, [enabled, invoice]);

  return { ...polling, paid };
}
