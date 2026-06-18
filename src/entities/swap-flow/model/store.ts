import type { SelectedToken } from '@entities/token';
import { trackFlowEvent } from '@shared/lib/monitoring';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import {
  EMPTY_CONTEXT,
  type Failure,
  type FailureReason,
  type FailureStep,
  type FlowContext,
  type FlowPhase,
  type FlowStatus,
  RETRY_TARGET,
  TRANSITIONS,
} from './types';

export interface SwapFlowState extends FlowContext {
  phase: FlowPhase;

  beginSelecting: () => void;
  cancelSelecting: () => void;
  setToken: (token: SelectedToken) => void;
  setDenomination: (denomination: number) => void;
  beginQuoting: () => void;
  quoteReady: () => void;
  backToEdit: () => void;
  requoteFromReview: () => void;
  confirmPurchase: () => void;
  invoiceCreated: (params: {
    invoiceId: string;
    orderId: string;
    paymentAddress: string;
    paymentPrice: string;
    next: 'approving' | 'swapping' | 'paying';
  }) => void;
  approveSubmitted: (txHash: string) => void;
  approveConfirmed: (next: 'swapping' | 'paying') => void;
  swapSubmitted: (txHash: string) => void;
  swapConfirmed: () => void;
  paymentSubmitted: (txHash: string) => void;
  invoicePaid: () => void;
  fail: (step: FailureStep, reason: FailureReason, message: string, recoverable?: boolean) => void;
  retryFromFailure: () => void;
  reset: () => void;
}

type PersistedSlice = Pick<SwapFlowState, 'phase'> & FlowContext;

/**
 * Decides where a reloaded session resumes. Pure so it is unit-testable:
 * - paid or polling → resume polling (the user must never lose a paid invoice)
 * - mid-execution with a live invoice → recoverable failure at that step
 * - anything earlier carries nothing durable → start over
 */
export function deriveResumedState(persisted: PersistedSlice): PersistedSlice {
  const { phase } = persisted;

  if (phase.status === 'success' && persisted.invoiceId) return persisted;
  if (phase.status === 'polling_invoice' && persisted.invoiceId) return persisted;
  if (phase.status === 'failed' && persisted.invoiceId) return persisted;

  if (phase.status === 'paying' && persisted.payTxHash) {
    return { ...persisted, phase: { status: 'polling_invoice' } };
  }

  const interruptedStep: Partial<Record<FlowStatus, FailureStep>> = {
    creating_invoice: 'create_invoice',
    approving: 'approve',
    swapping: 'swap',
    paying: 'pay',
  };
  const step = interruptedStep[phase.status];
  if (step && persisted.invoiceId) {
    return {
      ...persisted,
      phase: {
        status: 'failed',
        step,
        reason: 'interrupted',
        message:
          'The page was reloaded mid-purchase. Your invoice is still active — you can pick up where you left off.',
        recoverable: true,
      },
    };
  }

  return { ...EMPTY_CONTEXT, phase: { status: 'idle' } };
}

function isLegalTransition(from: FlowStatus, to: FlowStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const useSwapFlowStore = create<SwapFlowState>()(
  devtools(
    persist(
      (set, get) => {
        /** Guarded transition: illegal edges are ignored (and loudly logged in dev). */
        function transition(to: FlowPhase, extra?: Partial<FlowContext>): boolean {
          const from = get().phase.status;
          if (!isLegalTransition(from, to.status)) {
            if (import.meta.env.DEV) {
              console.warn(`swap-flow: illegal transition ${from} → ${to.status} ignored`);
            }
            return false;
          }
          set({ phase: to, ...extra }, false, `transition/${from}→${to.status}`);
          // Funnel breadcrumb — status only, never addresses/amounts (PII-free).
          trackFlowEvent(`${from}→${to.status}`);
          return true;
        }

        return {
          ...EMPTY_CONTEXT,
          phase: { status: 'idle' },

          beginSelecting: () => transition({ status: 'selecting' }),
          cancelSelecting: () => transition({ status: 'idle' }),

          setToken: (token) => {
            const { status } = get().phase;
            if (status !== 'selecting' && status !== 'idle') return;
            set({ token }, false, 'setToken');
          },

          setDenomination: (denomination) => {
            const { status } = get().phase;
            if (status !== 'selecting' && status !== 'idle') return;
            set({ denomination }, false, 'setDenomination');
          },

          beginQuoting: () => transition({ status: 'quoting' }),
          quoteReady: () => transition({ status: 'review' }),
          backToEdit: () => transition({ status: 'selecting' }),
          requoteFromReview: () => transition({ status: 'quoting' }),
          confirmPurchase: () => transition({ status: 'creating_invoice' }),

          invoiceCreated: ({ invoiceId, orderId, paymentAddress, paymentPrice, next }) =>
            transition({ status: next }, { invoiceId, orderId, paymentAddress, paymentPrice }),

          approveSubmitted: (txHash) => {
            if (get().phase.status !== 'approving') return;
            set({ approveTxHash: txHash }, false, 'approveSubmitted');
          },
          approveConfirmed: (next) => transition({ status: next }),

          swapSubmitted: (txHash) => {
            if (get().phase.status !== 'swapping') return;
            set({ swapTxHash: txHash }, false, 'swapSubmitted');
          },
          swapConfirmed: () => transition({ status: 'paying' }),

          paymentSubmitted: (txHash) => {
            transition({ status: 'polling_invoice' }, { payTxHash: txHash });
          },

          invoicePaid: () => transition({ status: 'success' }),

          fail: (step, reason, message, recoverable = true) => {
            const failure: Failure = { step, reason, message, recoverable };
            transition({ status: 'failed', ...failure });
          },

          retryFromFailure: () => {
            const { phase } = get();
            if (phase.status !== 'failed' || !phase.recoverable) return;
            transition({ status: RETRY_TARGET[phase.step] });
          },

          reset: () => set({ ...EMPTY_CONTEXT, phase: { status: 'idle' } }, false, 'reset'),
        };
      },
      {
        name: 'bitrefill-swap-flow',
        // sessionStorage on purpose: a paid invoice must survive reloads, but a
        // stale flow should not leak into tomorrow's browsing session.
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state): PersistedSlice => ({
          phase: state.phase,
          token: state.token,
          denomination: state.denomination,
          invoiceId: state.invoiceId,
          orderId: state.orderId,
          paymentAddress: state.paymentAddress,
          paymentPrice: state.paymentPrice,
          approveTxHash: state.approveTxHash,
          swapTxHash: state.swapTxHash,
          payTxHash: state.payTxHash,
        }),
        merge: (persisted, current) => {
          if (!persisted) return current;
          const resumed = deriveResumedState(persisted as PersistedSlice);
          return { ...current, ...resumed };
        },
      }
    ),
    { name: 'BitrefillSwapFlow' }
  )
);
