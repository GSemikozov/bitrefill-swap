import { describe, expect, it } from 'vitest';
import { buildSteps } from './steps';

const baseInput = {
  usdcDirect: false,
  invoiceId: 'inv-1',
  approveTxHash: null,
  swapTxHash: null,
  payTxHash: null,
};

describe('buildSteps', () => {
  it('hides approve and swap for the USDC-direct path', () => {
    const steps = buildSteps({ ...baseInput, usdcDirect: true, phaseStatus: 'paying' });
    expect(steps.map((s) => s.id)).toEqual(['invoice', 'pay', 'confirm']);
  });

  it('marks the active step as awaiting wallet before a tx exists', () => {
    const steps = buildSteps({ ...baseInput, phaseStatus: 'swapping' });
    expect(steps.find((s) => s.id === 'swap')?.state).toBe('wallet');
  });

  it('switches to confirming once the tx hash is known', () => {
    const steps = buildSteps({ ...baseInput, phaseStatus: 'swapping', swapTxHash: '0xs' });
    const swap = steps.find((s) => s.id === 'swap');
    expect(swap?.state).toBe('confirming');
    expect(swap?.txHash).toBe('0xs');
  });

  it('drops the approve step entirely once execution passed it without a tx', () => {
    const steps = buildSteps({ ...baseInput, phaseStatus: 'swapping' });
    expect(steps.map((s) => s.id)).toEqual(['invoice', 'swap', 'pay', 'confirm']);
  });

  it('keeps the approve step (done) when an approval tx happened', () => {
    const steps = buildSteps({
      ...baseInput,
      phaseStatus: 'paying',
      approveTxHash: '0xa',
      swapTxHash: '0xs',
    });
    expect(steps.find((s) => s.id === 'approve')?.state).toBe('done');
    expect(steps.find((s) => s.id === 'pay')?.state).toBe('wallet');
  });

  it('marks earlier steps done and the failed step failed', () => {
    const steps = buildSteps({
      ...baseInput,
      phaseStatus: 'failed',
      failedStep: 'pay',
      swapTxHash: '0xs',
    });
    expect(steps.find((s) => s.id === 'swap')?.state).toBe('done');
    expect(steps.find((s) => s.id === 'pay')?.state).toBe('failed');
    expect(steps.find((s) => s.id === 'confirm')?.state).toBe('pending');
  });

  it('shows polling as confirming with everything before it done', () => {
    const steps = buildSteps({
      ...baseInput,
      phaseStatus: 'polling_invoice',
      swapTxHash: '0xs',
      payTxHash: '0xp',
    });
    expect(steps.find((s) => s.id === 'confirm')?.state).toBe('confirming');
    expect(steps.find((s) => s.id === 'pay')?.state).toBe('done');
  });
});
