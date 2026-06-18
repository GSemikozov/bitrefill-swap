import type { FailureStep, FlowStatus } from '@entities/swap-flow';

type StepId = 'invoice' | 'approve' | 'swap' | 'pay' | 'confirm';

type StepState = 'pending' | 'wallet' | 'confirming' | 'done' | 'failed';

export interface StepView {
  id: StepId;
  label: string;
  state: StepState;
  txHash?: string;
}

interface BuildStepsInput {
  phaseStatus: FlowStatus;
  failedStep?: FailureStep;
  usdcDirect: boolean;
  invoiceId: string | null;
  approveTxHash: string | null;
  swapTxHash: string | null;
  payTxHash: string | null;
}

const PHASE_RANK: Partial<Record<FlowStatus, number>> = {
  creating_invoice: 0,
  approving: 1,
  swapping: 2,
  paying: 3,
  polling_invoice: 4,
  success: 5,
};

const FAILED_STEP_RANK: Record<FailureStep, number> = {
  quote: 0,
  create_invoice: 0,
  approve: 1,
  swap: 2,
  pay: 3,
  poll: 4,
};

const STEP_RANK: Record<StepId, number> = {
  invoice: 0,
  approve: 1,
  swap: 2,
  pay: 3,
  confirm: 4,
};

/**
 * Pure derivation of the vertical step indicator from FSM state.
 * The approve step is shown only while it may still happen (or did happen):
 * once execution moved past it without a tx, it was skipped entirely.
 */
export function buildSteps(input: BuildStepsInput): StepView[] {
  const { phaseStatus, failedStep, usdcDirect, approveTxHash, swapTxHash, payTxHash } = input;

  const currentRank =
    phaseStatus === 'failed' && failedStep !== undefined
      ? FAILED_STEP_RANK[failedStep]
      : (PHASE_RANK[phaseStatus] ?? 0);

  const txByStep: Partial<Record<StepId, string | null>> = {
    approve: approveTxHash,
    swap: swapTxHash,
    pay: payTxHash,
  };

  const approveKnownNeeded = Boolean(approveTxHash) || currentRank === 1;
  const approveSkipped = currentRank > 1 && !approveTxHash;

  const ids: StepId[] = ['invoice'];
  if (!usdcDirect && !approveSkipped) ids.push('approve');
  if (!usdcDirect) ids.push('swap');
  ids.push('pay', 'confirm');

  const labels: Record<StepId, string> = {
    invoice: 'Create invoice',
    approve: approveKnownNeeded ? 'Approve token' : 'Approve token (if needed)',
    swap: `Swap to USDC`,
    pay: 'Pay invoice',
    confirm: 'Confirm payment',
  };

  return ids.map((id) => {
    const rank = STEP_RANK[id];
    let state: StepState;
    if (rank < currentRank) {
      state = 'done';
    } else if (rank > currentRank) {
      state = 'pending';
    } else if (phaseStatus === 'failed') {
      state = 'failed';
    } else if (id === 'invoice' || id === 'confirm') {
      state = 'confirming';
    } else {
      state = txByStep[id] ? 'confirming' : 'wallet';
    }
    return { id, label: labels[id], state, txHash: txByStep[id] ?? undefined };
  });
}
