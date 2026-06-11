import type { Address } from 'viem';

/** Serializable token selection — amounts are intentionally not stored here. */
export interface SelectedToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

export type FlowStatus =
  | 'idle'
  | 'selecting'
  | 'quoting'
  | 'review'
  | 'creating_invoice'
  | 'approving'
  | 'swapping'
  | 'paying'
  | 'polling_invoice'
  | 'success'
  | 'failed';

/** Which step of the flow broke — determines where retry re-enters. */
export type FailureStep = 'quote' | 'create_invoice' | 'approve' | 'swap' | 'pay' | 'poll';

export type FailureReason =
  | 'user_rejected'
  | 'insufficient_funds'
  | 'quote_expired'
  | 'network'
  | 'api'
  | 'interrupted'
  | 'unknown';

export interface Failure {
  step: FailureStep;
  reason: FailureReason;
  message: string;
  /** False only when retrying is pointless (e.g. invoice expired) — UI offers reset instead. */
  recoverable: boolean;
}

export type FlowPhase =
  | { status: Exclude<FlowStatus, 'failed'> }
  | ({ status: 'failed' } & Failure);

/** Durable facts about the in-flight purchase. All serializable (no bigint). */
export interface FlowContext {
  token: SelectedToken | null;
  /** Gift card denomination in USD (e.g. 10). */
  denomination: number | null;
  invoiceId: string | null;
  orderId: string | null;
  paymentAddress: string | null;
  /** Exact USDC the invoice requires, base units as string. */
  paymentPrice: string | null;
  approveTxHash: string | null;
  swapTxHash: string | null;
  payTxHash: string | null;
}

export const EMPTY_CONTEXT: FlowContext = {
  token: null,
  denomination: null,
  invoiceId: null,
  orderId: null,
  paymentAddress: null,
  paymentPrice: null,
  approveTxHash: null,
  swapTxHash: null,
  payTxHash: null,
};

/** Valid edges of the state machine. Anything not listed is rejected by the guard. */
export const TRANSITIONS: Record<FlowStatus, readonly FlowStatus[]> = {
  idle: ['selecting'],
  selecting: ['quoting', 'idle'],
  quoting: ['review', 'selecting', 'failed'],
  review: ['creating_invoice', 'selecting', 'quoting'],
  creating_invoice: ['approving', 'swapping', 'paying', 'failed'],
  approving: ['swapping', 'paying', 'failed'],
  swapping: ['paying', 'failed'],
  paying: ['polling_invoice', 'failed'],
  polling_invoice: ['success', 'failed'],
  success: ['idle'],
  failed: [
    'quoting',
    'creating_invoice',
    'approving',
    'swapping',
    'paying',
    'polling_invoice',
    'idle',
  ],
};

/** Where retry re-enters the machine for each failed step. */
export const RETRY_TARGET: Record<FailureStep, Exclude<FlowStatus, 'failed'>> = {
  quote: 'quoting',
  create_invoice: 'creating_invoice',
  approve: 'approving',
  swap: 'swapping',
  pay: 'paying',
  poll: 'polling_invoice',
};
