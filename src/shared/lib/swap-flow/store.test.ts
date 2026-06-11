import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveResumedState, useSwapFlowStore } from './store';
import { EMPTY_CONTEXT, type SelectedToken } from './types';

const weth: SelectedToken = {
  address: '0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
};

const invoiceParams = {
  invoiceId: 'inv-1',
  orderId: 'ord-1',
  paymentAddress: '0x46968d7257d41159D37048CEDA686E2A0A8E8A89',
  paymentPrice: '10500000',
} as const;

function resetStore() {
  useSwapFlowStore.setState({ ...EMPTY_CONTEXT, phase: { status: 'idle' } });
}

function advanceToReview() {
  const store = useSwapFlowStore.getState();
  store.beginSelecting();
  store.setToken(weth);
  store.setDenomination(10);
  store.beginQuoting();
  store.quoteReady();
}

function advanceToPolling() {
  advanceToReview();
  const store = useSwapFlowStore.getState();
  store.confirmPurchase();
  store.invoiceCreated({ ...invoiceParams, next: 'approving' });
  store.approveSubmitted('0xapprove');
  store.approveConfirmed('swapping');
  store.swapSubmitted('0xswap');
  store.swapConfirmed();
  store.paymentSubmitted('0xpay');
}

describe('useSwapFlowStore transitions', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  it('walks the full happy path', () => {
    advanceToPolling();
    expect(useSwapFlowStore.getState().phase.status).toBe('polling_invoice');

    useSwapFlowStore.getState().invoicePaid();
    expect(useSwapFlowStore.getState().phase.status).toBe('success');

    const state = useSwapFlowStore.getState();
    expect(state.invoiceId).toBe('inv-1');
    expect(state.approveTxHash).toBe('0xapprove');
    expect(state.swapTxHash).toBe('0xswap');
    expect(state.payTxHash).toBe('0xpay');
  });

  it('skips approve and swap when invoice says next is paying (USDC-direct path)', () => {
    advanceToReview();
    const store = useSwapFlowStore.getState();
    store.confirmPurchase();
    store.invoiceCreated({ ...invoiceParams, next: 'paying' });
    expect(useSwapFlowStore.getState().phase.status).toBe('paying');
    expect(useSwapFlowStore.getState().approveTxHash).toBeNull();
    expect(useSwapFlowStore.getState().swapTxHash).toBeNull();
  });

  it('skips approving when allowance is sufficient', () => {
    advanceToReview();
    const store = useSwapFlowStore.getState();
    store.confirmPurchase();
    store.invoiceCreated({ ...invoiceParams, next: 'swapping' });
    expect(useSwapFlowStore.getState().phase.status).toBe('swapping');
  });

  it('rejects illegal transitions and keeps state unchanged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useSwapFlowStore.getState().invoicePaid(); // idle → success is illegal
    expect(useSwapFlowStore.getState().phase.status).toBe('idle');

    useSwapFlowStore.getState().confirmPurchase(); // idle → creating_invoice is illegal
    expect(useSwapFlowStore.getState().phase.status).toBe('idle');

    expect(warn).toHaveBeenCalled();
  });

  it('ignores tx hash setters outside their state', () => {
    useSwapFlowStore.getState().approveSubmitted('0xnope');
    useSwapFlowStore.getState().swapSubmitted('0xnope');
    expect(useSwapFlowStore.getState().approveTxHash).toBeNull();
    expect(useSwapFlowStore.getState().swapTxHash).toBeNull();
  });

  it('only allows token/denomination changes before quoting', () => {
    advanceToReview();
    useSwapFlowStore.getState().setToken({ ...weth, symbol: 'OTHER' });
    useSwapFlowStore.getState().setDenomination(50);
    expect(useSwapFlowStore.getState().token?.symbol).toBe('WETH');
    expect(useSwapFlowStore.getState().denomination).toBe(10);
  });

  it('supports re-quoting from review on quote expiry', () => {
    advanceToReview();
    useSwapFlowStore.getState().requoteFromReview();
    expect(useSwapFlowStore.getState().phase.status).toBe('quoting');
  });

  it('records failure with step and reason, and retries into the right state', () => {
    advanceToPolling();
    useSwapFlowStore.getState().fail('poll', 'network', 'Connection lost');

    const phase = useSwapFlowStore.getState().phase;
    expect(phase).toMatchObject({
      status: 'failed',
      step: 'poll',
      reason: 'network',
      recoverable: true,
    });

    useSwapFlowStore.getState().retryFromFailure();
    expect(useSwapFlowStore.getState().phase.status).toBe('polling_invoice');
    // Context survives the failure round-trip — the invoice is not lost.
    expect(useSwapFlowStore.getState().invoiceId).toBe('inv-1');
  });

  it('does not retry unrecoverable failures', () => {
    advanceToPolling();
    useSwapFlowStore.getState().fail('poll', 'api', 'Invoice expired', false);
    useSwapFlowStore.getState().retryFromFailure();
    expect(useSwapFlowStore.getState().phase.status).toBe('failed');
  });

  it('reset clears all context from any state', () => {
    advanceToPolling();
    useSwapFlowStore.getState().reset();
    const state = useSwapFlowStore.getState();
    expect(state.phase.status).toBe('idle');
    expect(state.invoiceId).toBeNull();
    expect(state.token).toBeNull();
    expect(state.payTxHash).toBeNull();
  });
});

describe('persistence partialize', () => {
  beforeEach(resetStore);

  it('persists only the durable slice (phase + context, no actions)', () => {
    advanceToPolling();
    const persistedRaw = sessionStorage.getItem('bitrefill-swap-flow');
    expect(persistedRaw).not.toBeNull();

    const persisted = JSON.parse(persistedRaw as string).state;
    expect(persisted).toEqual({
      phase: { status: 'polling_invoice' },
      token: weth,
      denomination: 10,
      invoiceId: 'inv-1',
      orderId: 'ord-1',
      paymentAddress: invoiceParams.paymentAddress,
      paymentPrice: '10500000',
      approveTxHash: '0xapprove',
      swapTxHash: '0xswap',
      payTxHash: '0xpay',
    });
  });
});

describe('deriveResumedState (reload mid-flow)', () => {
  const baseContext = {
    ...EMPTY_CONTEXT,
    token: weth,
    denomination: 10,
    invoiceId: 'inv-1',
    orderId: 'ord-1',
    paymentAddress: invoiceParams.paymentAddress,
    paymentPrice: '10500000',
  };

  it('resumes polling as-is so a paid invoice is never lost', () => {
    const resumed = deriveResumedState({
      ...baseContext,
      payTxHash: '0xpay',
      phase: { status: 'polling_invoice' },
    });
    expect(resumed.phase.status).toBe('polling_invoice');
    expect(resumed.invoiceId).toBe('inv-1');
  });

  it('keeps success so the code stays visible after reload', () => {
    const resumed = deriveResumedState({ ...baseContext, phase: { status: 'success' } });
    expect(resumed.phase.status).toBe('success');
  });

  it('promotes paying → polling when the payment tx was already sent', () => {
    const resumed = deriveResumedState({
      ...baseContext,
      payTxHash: '0xpay',
      phase: { status: 'paying' },
    });
    expect(resumed.phase.status).toBe('polling_invoice');
  });

  it('turns interrupted execution states into recoverable failures', () => {
    for (const [status, step] of [
      ['approving', 'approve'],
      ['swapping', 'swap'],
      ['paying', 'pay'],
    ] as const) {
      const resumed = deriveResumedState({ ...baseContext, phase: { status } });
      expect(resumed.phase).toMatchObject({ status: 'failed', step, recoverable: true });
      expect(resumed.invoiceId).toBe('inv-1');
    }
  });

  it('resets pre-invoice states to idle', () => {
    for (const status of ['selecting', 'quoting', 'review'] as const) {
      const resumed = deriveResumedState({
        ...EMPTY_CONTEXT,
        token: weth,
        denomination: 10,
        phase: { status },
      });
      expect(resumed.phase.status).toBe('idle');
      expect(resumed.token).toBeNull();
    }
  });
});
