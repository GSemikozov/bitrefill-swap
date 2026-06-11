import { extractRedemptionCode, fetchOrder } from '@shared/api/bitrefill';
import { QUERY_KEYS } from '@shared/api/query-keys';
import { INVOICE_POLL_INTERVAL_MS } from '@shared/config';
import { useQuery } from '@tanstack/react-query';

/** Fetches the order and keeps polling briefly until the redemption code appears. */
export function useOrder(orderId: string | null, enabled: boolean) {
  const query = useQuery({
    queryKey: QUERY_KEYS.bitrefill.order(orderId ?? undefined),
    queryFn: () => {
      if (!orderId) throw new Error('No order id');
      return fetchOrder(orderId);
    },
    enabled: Boolean(orderId) && enabled,
    refetchInterval: (q) => {
      const order = q.state.data;
      if (order && extractRedemptionCode(order)) return false;
      return INVOICE_POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    retry: 3,
  });

  return {
    ...query,
    order: query.data,
    redemptionCode: query.data ? extractRedemptionCode(query.data) : undefined,
  };
}
