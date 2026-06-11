import { isApiError } from '@shared/api';
import type { FailureReason } from './swap-flow/types';

export interface MappedFailure {
  reason: FailureReason;
  message: string;
}

function messageChain(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    // viem wraps causes deeply; collect the chain for keyword matching.
    const parts: string[] = [];
    let current: unknown = error;
    while (current instanceof Error && parts.length < 5) {
      parts.push(current.message);
      current = current.cause;
    }
    return parts.join(' | ');
  }
  return String(error);
}

/**
 * Maps wallet / RPC / API errors to a stable reason and a sentence a human can
 * act on. Raw RPC strings never reach the UI.
 */
export function mapExecutionError(error: unknown): MappedFailure {
  if (import.meta.env.DEV) {
    // The mapped message hides the original — keep it visible for debugging.
    console.error('[swap-flow] execution error:', error);
  }
  const chain = messageChain(error).toLowerCase();

  if (chain.includes('user rejected') || chain.includes('user denied')) {
    return {
      reason: 'user_rejected',
      message: 'You declined the request in your wallet. No funds moved — retry when ready.',
    };
  }
  if (chain.includes('insufficient funds') || chain.includes('exceeds the balance')) {
    return {
      reason: 'insufficient_funds',
      message: 'Not enough balance to cover this transaction plus network fees.',
    };
  }
  if (chain.includes('quote') && chain.includes('expired')) {
    return {
      reason: 'quote_expired',
      message: 'The price quote expired. We will fetch a fresh one.',
    };
  }
  if (chain.includes('slippage') || chain.includes('too little received')) {
    return {
      reason: 'quote_expired',
      message:
        'The price moved beyond the allowed slippage. Retrying with a fresh quote should fix it.',
    };
  }

  if (isApiError(error)) {
    if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
      return {
        reason: 'network',
        message: 'Network hiccup while talking to the service. Check your connection and retry.',
      };
    }
    return {
      reason: 'api',
      message: 'The service returned an unexpected response. Retrying usually helps.',
    };
  }

  if (chain.includes('network') || chain.includes('fetch') || chain.includes('timeout')) {
    return {
      reason: 'network',
      message: 'Network hiccup. Check your connection and retry.',
    };
  }

  return {
    reason: 'unknown',
    message: 'Something unexpected went wrong. Your funds are safe — please retry.',
  };
}
