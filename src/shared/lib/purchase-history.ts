/**
 * Durable, device-local record of completed purchases — ids only, never codes:
 * the redemption code is re-fetched on demand via the order endpoint, so no
 * secret sits in localStorage. Query caches die on reload, and listing the
 * shared merchant account's invoices from the API would expose other users'
 * orders — device-local ids are the honest scope (see WRITEUP).
 */

const STORAGE_KEY = 'bitrefill-swap-history';
const MAX_ENTRIES = 20;

export interface PurchaseRecord {
  orderId: string;
  invoiceId: string;
  /** USD denomination, e.g. 10. */
  denomination: number;
  /** Wallet the purchase was made with — history is filtered per account. */
  address: string;
  completedAt: string;
  swapTxHash?: string;
  payTxHash?: string;
  demo: boolean;
}

function safeParse(raw: string | null): PurchaseRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadPurchaseHistory(address?: string): PurchaseRecord[] {
  const all = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (!address) return all;
  return all.filter((entry) => entry.address.toLowerCase() === address.toLowerCase());
}

/** Idempotent by orderId; newest first; capped so the list never grows unbounded. */
export function recordPurchase(record: PurchaseRecord): void {
  const all = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (all.some((entry) => entry.orderId === record.orderId)) return;
  const next = [record, ...all].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
