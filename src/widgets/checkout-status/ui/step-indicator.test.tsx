import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StepView } from '../model/steps';
import { StepIndicator } from './step-indicator';

const steps: StepView[] = [
  { id: 'invoice', label: 'Create invoice', state: 'done' },
  { id: 'swap', label: 'Swap to USDC', state: 'confirming', txHash: '0xabc' },
  { id: 'pay', label: 'Pay invoice', state: 'wallet' },
  { id: 'confirm', label: 'Confirm payment', state: 'pending' },
];

describe('StepIndicator', () => {
  it('renders every step with its state hint', () => {
    render(<StepIndicator steps={steps} />);
    expect(screen.getByText('Create invoice')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Confirming…')).toBeInTheDocument();
    expect(screen.getByText('Confirm in your wallet')).toBeInTheDocument();
  });

  it('links confirming steps to the explorer', () => {
    render(<StepIndicator steps={steps} />);
    const link = screen.getByRole('link', { name: /view on basescan/i });
    expect(link).toHaveAttribute('href', 'https://basescan.org/tx/0xabc');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders failed state', () => {
    render(<StepIndicator steps={[{ id: 'pay', label: 'Pay invoice', state: 'failed' }]} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
