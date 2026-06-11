import { beforeEach, describe, expect, it } from 'vitest';
import { loadPurchaseHistory, type PurchaseRecord, recordPurchase } from './purchase-history';

function makeRecord(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    orderId: 'ord-1',
    invoiceId: 'inv-1',
    denomination: 10,
    address: '0xAbC0000000000000000000000000000000000001',
    completedAt: '2026-06-12T10:00:00.000Z',
    payTxHash: '0xpay',
    demo: false,
    ...overrides,
  };
}

describe('purchase history storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('records and loads purchases, newest first', () => {
    recordPurchase(makeRecord({ orderId: 'a', completedAt: '2026-06-11T10:00:00Z' }));
    recordPurchase(makeRecord({ orderId: 'b', completedAt: '2026-06-12T10:00:00Z' }));
    expect(loadPurchaseHistory().map((r) => r.orderId)).toEqual(['b', 'a']);
  });

  it('is idempotent by orderId (success screen can re-render freely)', () => {
    recordPurchase(makeRecord());
    recordPurchase(makeRecord());
    expect(loadPurchaseHistory()).toHaveLength(1);
  });

  it('filters by wallet address case-insensitively', () => {
    recordPurchase(makeRecord({ orderId: 'mine' }));
    recordPurchase(
      makeRecord({ orderId: 'other', address: '0xDef0000000000000000000000000000000000002' })
    );
    const mine = loadPurchaseHistory('0xabc0000000000000000000000000000000000001');
    expect(mine.map((r) => r.orderId)).toEqual(['mine']);
  });

  it('caps the list at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      recordPurchase(makeRecord({ orderId: `ord-${i}` }));
    }
    expect(loadPurchaseHistory()).toHaveLength(20);
  });

  it('survives corrupted storage', () => {
    window.localStorage.setItem('bitrefill-swap-history', '{not json');
    expect(loadPurchaseHistory()).toEqual([]);
    recordPurchase(makeRecord());
    expect(loadPurchaseHistory()).toHaveLength(1);
  });
});
