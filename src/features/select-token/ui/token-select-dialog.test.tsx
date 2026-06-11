import { EMPTY_CONTEXT, useSwapFlowStore } from '@shared/lib/swap-flow';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenSelectDialog } from './token-select-dialog';

const mockUseHeldTokens = vi.fn();

vi.mock('wagmi', async (importOriginal) => {
  const original = await importOriginal<typeof import('wagmi')>();
  return {
    ...original,
    useAccount: () => ({ address: '0x000000000000000000000000000000000000dEaD' }),
  };
});

vi.mock('@entities/token', async (importOriginal) => {
  const original = await importOriginal<typeof import('@entities/token')>();
  return {
    ...original,
    useHeldTokens: (...args: unknown[]) => mockUseHeldTokens(...args),
  };
});

const eth = {
  address: '0x0000000000000000000000000000000000000000' as const,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  balance: 1_000_000_000_000_000_000n,
  priceUsd: 2100,
};

const usdc = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  balance: 25_000_000n,
  priceUsd: 1,
};

describe('TokenSelectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSwapFlowStore.setState({ ...EMPTY_CONTEXT, phase: { status: 'selecting' } });
    mockUseHeldTokens.mockReturnValue({
      data: [eth, usdc],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('lists held tokens with balances', () => {
    render(<TokenSelectDialog open onOpenChange={() => {}} />);
    expect(screen.getByText('Ether')).toBeInTheDocument();
    expect(screen.getByText('USD Coin')).toBeInTheDocument();
    expect(screen.getByText('$2,100.00')).toBeInTheDocument();
  });

  it('filters by search and shows the empty message for no matches', async () => {
    const user = userEvent.setup();
    render(<TokenSelectDialog open onOpenChange={() => {}} />);

    await user.type(screen.getByPlaceholderText(/search/i), 'usd');
    expect(screen.queryByText('Ether')).not.toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText(/search/i));
    await user.type(screen.getByPlaceholderText(/search/i), 'doge');
    expect(screen.getByText('No tokens with balance on Base.')).toBeInTheDocument();
  });

  it('selects a token into the flow store and closes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<TokenSelectDialog open onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('USDC'));
    expect(useSwapFlowStore.getState().token?.symbol).toBe('USDC');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows skeletons while balances load', () => {
    mockUseHeldTokens.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(<TokenSelectDialog open onOpenChange={() => {}} />);
    expect(screen.getByRole('status', { name: /loading balances/i })).toBeInTheDocument();
  });

  it('offers a retry when discovery fails', async () => {
    const refetch = vi.fn();
    mockUseHeldTokens.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    render(<TokenSelectDialog open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
