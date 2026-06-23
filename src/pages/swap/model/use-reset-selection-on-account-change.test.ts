import { EMPTY_CONTEXT, useSwapFlowStore } from '@entities/swap-flow';
import type { SelectedToken } from '@entities/token';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResetSelectionOnAccountChange } from './use-reset-selection-on-account-change';

const WALLET_A = '0x000000000000000000000000000000000000000A';
const WALLET_B = '0x000000000000000000000000000000000000000B';

let currentAddress: string | undefined;

vi.mock('wagmi', async (importOriginal) => {
  const original = await importOriginal<typeof import('wagmi')>();
  return {
    ...original,
    useAccount: () => ({ address: currentAddress }),
  };
});

const weth: SelectedToken = {
  address: '0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
};

function selectAToken() {
  const store = useSwapFlowStore.getState();
  store.beginSelecting();
  store.setToken(weth);
}

describe('useResetSelectionOnAccountChange', () => {
  beforeEach(() => {
    currentAddress = undefined;
    useSwapFlowStore.setState({ ...EMPTY_CONTEXT, phase: { status: 'idle' } });
  });

  it('keeps the selection on the first connect (undefined → A)', () => {
    selectAToken();
    const { rerender } = renderHook(() => useResetSelectionOnAccountChange());

    currentAddress = WALLET_A;
    rerender();

    expect(useSwapFlowStore.getState().token?.symbol).toBe('WETH');
  });

  it('keeps the selection when the same address re-renders', () => {
    currentAddress = WALLET_A;
    const { rerender } = renderHook(() => useResetSelectionOnAccountChange());
    selectAToken();

    rerender();

    expect(useSwapFlowStore.getState().token?.symbol).toBe('WETH');
  });

  it('clears the selection when the account switches A → B', () => {
    currentAddress = WALLET_A;
    const { rerender } = renderHook(() => useResetSelectionOnAccountChange());
    selectAToken();

    currentAddress = WALLET_B;
    rerender();

    expect(useSwapFlowStore.getState().token).toBeNull();
  });

  it('clears the selection on disconnect → a different wallet', () => {
    currentAddress = WALLET_A;
    const { rerender } = renderHook(() => useResetSelectionOnAccountChange());
    selectAToken();

    currentAddress = undefined; // disconnect
    rerender();
    expect(useSwapFlowStore.getState().token?.symbol).toBe('WETH'); // untouched while disconnected

    currentAddress = WALLET_B; // reconnect a different wallet
    rerender();
    expect(useSwapFlowStore.getState().token).toBeNull();
  });
});
