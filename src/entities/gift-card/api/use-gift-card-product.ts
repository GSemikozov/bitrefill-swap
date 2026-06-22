import { fetchGiftCardProduct, type GiftCardProduct } from '@shared/api/bitrefill';
import { QUERY_KEYS } from '@shared/api/query-keys';
import { GIFT_CARD_PRODUCT_ID } from '@shared/config';
import { useQuery } from '@tanstack/react-query';

/**
 * Standard denominations of the test product (USD), used when the product
 * endpoint misbehaves. Also drives the loading-skeleton count so it matches
 * the expected number of chips.
 */
export const FALLBACK_DENOMINATIONS = [10, 20, 30, 50, 100];

export function useGiftCardProduct() {
  const query = useQuery({
    queryKey: QUERY_KEYS.bitrefill.product(GIFT_CARD_PRODUCT_ID),
    queryFn: fetchGiftCardProduct,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const denominations = query.data
    ? query.data.packages.map((pkg) => pkg.amount).sort((a, b) => a - b)
    : FALLBACK_DENOMINATIONS;

  return {
    ...query,
    denominations,
    usedFallback: query.isError,
    product: query.data as GiftCardProduct | undefined,
  };
}
