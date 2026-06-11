import { describe, expect, it } from 'vitest';
import { checkAffordability, createDenominationSchema } from './schema';

describe('createDenominationSchema', () => {
  const schema = createDenominationSchema([10, 20, 50]);

  it('accepts listed denominations', () => {
    expect(schema.safeParse({ denomination: 20 }).success).toBe(true);
  });

  it('rejects values outside the product list', () => {
    const result = schema.safeParse({ denomination: 25 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing denomination with a friendly message', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Pick a gift card amount');
    }
  });
});

describe('checkAffordability', () => {
  it('passes when balance covers the worst case', () => {
    expect(
      checkAffordability({ balance: 100n, maxInput: 90n, isNative: false, gasReserve: 0n })
    ).toBeNull();
  });

  it('flags insufficient balance', () => {
    expect(
      checkAffordability({ balance: 80n, maxInput: 90n, isNative: false, gasReserve: 0n })
    ).toBe('balance');
  });

  it('requires a gas reserve on top for native ETH', () => {
    expect(
      checkAffordability({ balance: 100n, maxInput: 95n, isNative: true, gasReserve: 10n })
    ).toBe('gas');
    expect(
      checkAffordability({ balance: 100n, maxInput: 95n, isNative: false, gasReserve: 10n })
    ).toBeNull();
  });
});
