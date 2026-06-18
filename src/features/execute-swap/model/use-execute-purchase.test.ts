import { EMPTY_CONTEXT, useSwapFlowStore } from '@entities/swap-flow';
import { setDemoPayment } from '@shared/config';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExecutePurchase } from './use-execute-purchase';

const WALLET = '0x000000000000000000000000000000000000dEaD';

const mockCreateInvoice = vi.fn();
vi.mock('@shared/api/bitrefill', () => ({
  createInvoice: (...args: unknown[]) => mockCreateInvoice(...args),
}));

const mockFetchSwapQuote = vi.fn();
const mockCheckApproval = vi.fn();
const mockBuildSwapTransaction = vi.fn();
vi.mock('@shared/api/uniswap', () => ({
  fetchSwapQuote: (...args: unknown[]) => mockFetchSwapQuote(...args),
  checkApproval: (...args: unknown[]) => mockCheckApproval(...args),
  buildSwapTransaction: (...args: unknown[]) => mockBuildSwapTransaction(...args),
}));

const mockSendTransaction = vi.fn();
const mockWriteContract = vi.fn();
const mockWaitForReceipt = vi.fn();
const mockSignTypedData = vi.fn();
vi.mock('wagmi/actions', () => ({
  sendTransaction: (...args: unknown[]) => mockSendTransaction(...args),
  writeContract: (...args: unknown[]) => mockWriteContract(...args),
  waitForTransactionReceipt: (...args: unknown[]) => mockWaitForReceipt(...args),
  signTypedData: (...args: unknown[]) => mockSignTypedData(...args),
}));

vi.mock('wagmi', async (importOriginal) => {
  const original = await importOriginal<typeof import('wagmi')>();
  return {
    ...original,
    useConfig: () => ({}),
    useAccount: () => ({ address: WALLET }),
  };
});

const weth = {
  address: '0x4200000000000000000000000000000000000006' as const,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
};

const usdc = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
};

const invoiceFixture = {
  id: 'inv-1',
  status: 'not_delivered',
  payment: {
    method: 'usdc_base',
    address: '0x46968d7257d41159D37048CEDA686E2A0A8E8A89',
    currency: 'USDC',
    price: 10_500_000,
    status: 'unpaid',
  },
  orders: [{ id: 'ord-1', status: 'created' }],
};

const quoteFixture = {
  requestId: 'req-1',
  routing: 'CLASSIC',
  permitData: { domain: {}, types: { PermitSingle: [] }, values: {} },
  quote: {
    chainId: 8453,
    tradeType: 'EXACT_OUTPUT',
    input: { token: weth.address, amount: '5000', maximumAmount: '5100' },
    output: { token: usdc.address, amount: '10500000' },
  },
};

function seedReview(token: typeof weth | typeof usdc = weth) {
  useSwapFlowStore.setState({
    ...EMPTY_CONTEXT,
    token,
    denomination: 10,
    phase: { status: 'review' },
  });
}

describe('useExecutePurchase (integration smoke, mocked clients)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateInvoice.mockResolvedValue(invoiceFixture);
    mockFetchSwapQuote.mockResolvedValue(quoteFixture);
    mockCheckApproval.mockResolvedValue(null);
    mockBuildSwapTransaction.mockResolvedValue({
      to: '0xrouter',
      data: '0xcalldata',
      value: '0x0',
      chainId: 8453,
      gasLimit: '500000',
    });
    mockSignTypedData.mockResolvedValue('0xsignature');
    mockSendTransaction.mockResolvedValue('0xswap');
    mockWriteContract.mockResolvedValue('0xpay');
    mockWaitForReceipt.mockResolvedValue({ status: 'success' });
  });

  it('drives the full happy path: invoice → swap → pay → polling', async () => {
    seedReview();
    const { result } = renderHook(() => useExecutePurchase());

    await act(() => result.current.start());

    const state = useSwapFlowStore.getState();
    expect(state.phase.status).toBe('polling_invoice');
    expect(state.invoiceId).toBe('inv-1');
    expect(state.orderId).toBe('ord-1');
    expect(state.paymentPrice).toBe('10500000');
    expect(state.swapTxHash).toBe('0xswap');
    expect(state.payTxHash).toBe('0xpay');
    expect(state.approveTxHash).toBeNull(); // allowance sufficed → approve skipped

    // Invoice first (only on confirm), then EXACT_OUTPUT re-quote for its price.
    expect(mockCreateInvoice).toHaveBeenCalledWith({ value: 10, refundAddress: WALLET });
    expect(mockFetchSwapQuote).toHaveBeenCalledWith({
      swapper: WALLET,
      tokenIn: weth.address,
      amountOut: '10500000',
    });
    // Permit2 signature passed through to the swap build.
    expect(mockSignTypedData).toHaveBeenCalled();
    expect(mockBuildSwapTransaction).toHaveBeenCalledWith({
      quoteResponse: quoteFixture,
      permitSignature: '0xsignature',
    });
    // Payment is a plain USDC transfer of the exact invoice price.
    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        functionName: 'transfer',
        args: [invoiceFixture.payment.address, 10_500_000n],
      })
    );

    // Paid invoice flips the machine to success.
    useSwapFlowStore.getState().invoicePaid();
    expect(useSwapFlowStore.getState().phase.status).toBe('success');
  });

  it('runs the approval step when the allowance is missing', async () => {
    mockCheckApproval.mockResolvedValue({ to: '0xtoken', data: '0xapprove', value: '0x00' });
    mockSendTransaction.mockResolvedValueOnce('0xapprovetx').mockResolvedValueOnce('0xswap');
    seedReview();
    const { result } = renderHook(() => useExecutePurchase());

    await act(() => result.current.start());

    const state = useSwapFlowStore.getState();
    expect(state.approveTxHash).toBe('0xapprovetx');
    expect(state.swapTxHash).toBe('0xswap');
    expect(state.phase.status).toBe('polling_invoice');
  });

  it('skips approve and swap entirely for USDC (direct payment)', async () => {
    seedReview(usdc);
    const { result } = renderHook(() => useExecutePurchase());

    await act(() => result.current.start());

    expect(mockFetchSwapQuote).not.toHaveBeenCalled();
    expect(mockSendTransaction).not.toHaveBeenCalled();
    expect(useSwapFlowStore.getState().phase.status).toBe('polling_invoice');
    expect(useSwapFlowStore.getState().payTxHash).toBe('0xpay');
  });

  it('maps a wallet rejection to a recoverable failure and retries the pay step', async () => {
    seedReview(usdc);
    mockWriteContract.mockRejectedValueOnce(new Error('User rejected the request.'));
    const { result } = renderHook(() => useExecutePurchase());

    await act(() => result.current.start());

    const failedPhase = useSwapFlowStore.getState().phase;
    expect(failedPhase).toMatchObject({
      status: 'failed',
      step: 'pay',
      reason: 'user_rejected',
      recoverable: true,
    });

    mockWriteContract.mockResolvedValueOnce('0xpay2');
    await act(() => result.current.retry());

    expect(useSwapFlowStore.getState().phase.status).toBe('polling_invoice');
    expect(useSwapFlowStore.getState().payTxHash).toBe('0xpay2');
  });

  describe('demo mode', () => {
    afterEach(() => {
      setDemoPayment(false);
    });

    it('skips every on-chain step and goes straight to polling', async () => {
      setDemoPayment(true);
      seedReview(); // non-USDC token — would normally swap
      const { result } = renderHook(() => useExecutePurchase());

      await act(() => result.current.start());

      expect(mockCreateInvoice).toHaveBeenCalled();
      expect(mockFetchSwapQuote).not.toHaveBeenCalled();
      expect(mockSendTransaction).not.toHaveBeenCalled();
      expect(mockWriteContract).not.toHaveBeenCalled();

      const state = useSwapFlowStore.getState();
      expect(state.phase.status).toBe('polling_invoice');
      expect(state.invoiceId).toBe('inv-1');
      expect(state.payTxHash).toBe(''); // no tx — no explorer link
    });
  });

  it('fails the create_invoice step when the API errors', async () => {
    seedReview();
    mockCreateInvoice.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useExecutePurchase());

    await act(() => result.current.start());

    expect(useSwapFlowStore.getState().phase).toMatchObject({
      status: 'failed',
      step: 'create_invoice',
    });
  });
});
