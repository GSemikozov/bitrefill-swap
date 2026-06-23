import type { DiscoveredToken } from '@shared/api/tokens';
import { render, screen } from '@testing-library/react';
import type { Address } from 'viem';
import { describe, expect, it } from 'vitest';
import { TokenRow } from './token-row';

function token(overrides: Partial<DiscoveredToken> = {}): DiscoveredToken {
  return {
    address: '0x4200000000000000000000000000000000000006' as Address,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    balance: 1_000000000000000000n,
    priceUsd: 2000,
    ...overrides,
  };
}

describe('TokenRow', () => {
  it('shows the balance and USD value for a held token', () => {
    render(<TokenRow token={token()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('$2,000.00')).toBeInTheDocument();
    expect(screen.queryByText('No balance')).not.toBeInTheDocument();
  });

  it('renders "No balance" for a zero-balance token (demo curated list)', () => {
    render(<TokenRow token={token({ balance: 0n, priceUsd: undefined })} />);
    expect(screen.getByText('No balance')).toBeInTheDocument();
    expect(screen.getByText('WETH')).toBeInTheDocument();
  });

  it('marks the currently selected token with a checkmark', () => {
    const { rerender } = render(<TokenRow token={token()} />);
    expect(screen.queryByLabelText('Selected')).not.toBeInTheDocument();
    rerender(<TokenRow token={token()} selected />);
    expect(screen.getByLabelText('Selected')).toBeInTheDocument();
  });
});
