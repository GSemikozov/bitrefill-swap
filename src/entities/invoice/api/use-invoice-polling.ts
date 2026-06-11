import { fetchInvoice, isInvoiceTerminal } from '@shared/api/bitrefill';
import { QUERY_KEYS } from '@shared/api/query-keys';
import { INVOICE_POLL_INTERVAL_MS, INVOICE_POLL_SOFT_TIMEOUT_MS } from '@shared/config';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/**
 * Smart polling per the plan: fixed cadence while the invoice is open, stops on
 * terminal states, pauses in background tabs, and reports a soft timeout after
 * ~5 minutes so the UI can switch to "taking longer than usual" — never an
 * infinite spinner.
 */
export function useInvoicePolling(invoiceId: string | null, enabled: boolean) {
  const query = useQuery({
    queryKey: QUERY_KEYS.bitrefill.invoice(invoiceId ?? undefined),
    queryFn: () => {
      if (!invoiceId) throw new Error('No invoice id');
      return fetchInvoice(invoiceId);
    },
    enabled: Boolean(invoiceId) && enabled,
    refetchInterval: (q) => {
      const invoice = q.state.data;
      if (invoice && isInvoiceTerminal(invoice)) return false;
      return INVOICE_POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
  });

  const [softTimedOut, setSoftTimedOut] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !invoiceId) {
      startedAtRef.current = null;
      setSoftTimedOut(false);
      return;
    }
    startedAtRef.current ??= Date.now();
    const remaining = startedAtRef.current + INVOICE_POLL_SOFT_TIMEOUT_MS - Date.now();
    if (remaining <= 0) {
      setSoftTimedOut(true);
      return;
    }
    const timer = setTimeout(() => setSoftTimedOut(true), remaining);
    return () => clearTimeout(timer);
  }, [enabled, invoiceId]);

  return { ...query, invoice: query.data, softTimedOut };
}
