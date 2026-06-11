import { EMPTY_CONTEXT, useSwapFlowStore } from '@shared/lib/swap-flow';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedemptionCard } from './index';

const mockUseOrder = vi.fn();

vi.mock('@entities/invoice', async (importOriginal) => {
  const original = await importOriginal<typeof import('@entities/invoice')>();
  return {
    ...original,
    useOrder: (...args: unknown[]) => mockUseOrder(...args),
  };
});

vi.mock('wagmi', async (importOriginal) => {
  const original = await importOriginal<typeof import('wagmi')>();
  return {
    ...original,
    useAccount: () => ({ address: '0x000000000000000000000000000000000000dEaD' }),
  };
});

const CODE = 'TEST-1234-5678-9012';

function setSuccessState() {
  useSwapFlowStore.setState({
    ...EMPTY_CONTEXT,
    phase: { status: 'success' },
    orderId: 'ord-1',
    invoiceId: 'inv-1',
    denomination: 10,
  });
}

describe('RedemptionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSuccessState();
    mockUseOrder.mockReturnValue({
      order: { id: 'ord-1', status: 'delivered' },
      redemptionCode: CODE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('masks the code by default and reveals on demand', async () => {
    const user = userEvent.setup();
    render(<RedemptionCard />);

    expect(screen.queryByText(CODE)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reveal code/i }));
    expect(screen.getByText(CODE)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hide code/i }));
    expect(screen.queryByText(CODE)).not.toBeInTheDocument();
  });

  it('copies the code to the clipboard without revealing it', async () => {
    const user = userEvent.setup();
    render(<RedemptionCard />);

    await user.click(screen.getByRole('button', { name: /copy code/i }));
    expect(await navigator.clipboard.readText()).toBe(CODE);
  });

  it('shows order and invoice ids', () => {
    render(<RedemptionCard />);
    expect(screen.getByText('ord-1')).toBeInTheDocument();
    expect(screen.getByText('inv-1')).toBeInTheDocument();
  });

  it('keeps the order safe with a retry when loading the code fails', async () => {
    const refetch = vi.fn();
    mockUseOrder.mockReturnValue({
      order: undefined,
      redemptionCode: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    render(<RedemptionCard />);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('resets the flow when starting a new swap', async () => {
    const user = userEvent.setup();
    render(<RedemptionCard />);

    await user.click(screen.getByRole('button', { name: /start a new swap/i }));
    expect(useSwapFlowStore.getState().phase.status).toBe('idle');
    expect(useSwapFlowStore.getState().orderId).toBeNull();
  });
});
