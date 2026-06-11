import { isUsdc } from '@entities/token';
import { createInvoice } from '@shared/api/bitrefill';
import { buildSwapTransaction, checkApproval, fetchSwapQuote } from '@shared/api/uniswap';
import { isDemoPayment, USDC_BASE_ADDRESS } from '@shared/config';
import { mapExecutionError } from '@shared/lib';
import { useSwapFlowStore } from '@shared/lib/swap-flow';
import { useCallback } from 'react';
import type { Address } from 'viem';
import { erc20Abi } from 'viem';
import type { Config } from 'wagmi';
import { useAccount, useConfig } from 'wagmi';
import { sendTransaction, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { signPermit } from './permit';

const store = () => useSwapFlowStore.getState();

function failWith(step: 'create_invoice' | 'approve' | 'swap' | 'pay', error: unknown): false {
  const mapped = mapExecutionError(error);
  store().fail(step, mapped.reason, mapped.message);
  return false;
}

/** EXACT_OUTPUT re-quote for the invoice's exact USDC price. */
async function fetchQuoteForPayment(address: Address) {
  const { token, paymentPrice } = store();
  if (!token || !paymentPrice) throw new Error('Missing purchase context');
  return fetchSwapQuote({ swapper: address, tokenIn: token.address, amountOut: paymentPrice });
}

type PaymentQuote = Awaited<ReturnType<typeof fetchQuoteForPayment>>;

async function runApproval(
  config: Config,
  approvalTx: { to: `0x${string}`; data: `0x${string}`; value: `0x${string}` }
): Promise<boolean> {
  try {
    const hash = await sendTransaction(config, {
      to: approvalTx.to,
      data: approvalTx.data,
      value: BigInt(approvalTx.value),
    });
    store().approveSubmitted(hash);
    await waitForTransactionReceipt(config, { hash });
    store().approveConfirmed('swapping');
    return true;
  } catch (error) {
    return failWith('approve', error);
  }
}

async function runSwap(
  config: Config,
  address: Address,
  existingQuote: PaymentQuote | null
): Promise<boolean> {
  try {
    const quote = existingQuote ?? (await fetchQuoteForPayment(address));
    const signature = quote.permitData ? await signPermit(config, quote.permitData) : undefined;
    const tx = await buildSwapTransaction({ quoteResponse: quote, permitSignature: signature });
    const hash = await sendTransaction(config, {
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value),
      gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
    });
    store().swapSubmitted(hash);
    await waitForTransactionReceipt(config, { hash });
    store().swapConfirmed();
    return true;
  } catch (error) {
    return failWith('swap', error);
  }
}

/** Plain ERC-20 transfer of the exact invoice price to Bitrefill's address. */
async function runPayment(config: Config): Promise<boolean> {
  const { paymentAddress, paymentPrice } = store();
  if (!paymentAddress || !paymentPrice) {
    return failWith('pay', new Error('Missing payment details'));
  }
  try {
    const hash = await writeContract(config, {
      address: USDC_BASE_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [paymentAddress as Address, BigInt(paymentPrice)],
      // Explicit gas: right after the swap, the wallet's RPC may lag a block
      // and estimate against a pre-swap USDC balance — the failed estimation
      // makes some wallets submit an absurd fallback limit that Base rejects
      // ("exceeds maximum per-tx gas limit"). A plain transfer fits in 100k.
      gas: 100_000n,
    });
    store().paymentSubmitted(hash);
    return true;
  } catch (error) {
    return failWith('pay', error);
  }
}

/**
 * Creates the invoice (the real order — only on user confirm), then routes to
 * the right execution path: USDC-direct skips straight to payment; otherwise
 * quote → approval (skipped when allowance suffices) → swap → payment.
 */
async function runFromInvoice(config: Config, address: Address): Promise<void> {
  const { token, denomination } = store();
  if (!token || !denomination) return;

  let invoiceParams: {
    invoiceId: string;
    orderId: string;
    paymentAddress: string;
    paymentPrice: string;
  };
  try {
    const invoice = await createInvoice({ value: denomination, refundAddress: address });
    invoiceParams = {
      invoiceId: invoice.id,
      orderId: invoice.orders[0]?.id ?? '',
      // No address for balance-paid (demo) invoices — nothing is sent on-chain.
      paymentAddress: invoice.payment.address ?? '',
      paymentPrice: String(invoice.payment.price),
    };
  } catch (error) {
    failWith('create_invoice', error);
    return;
  }

  if (isDemoPayment()) {
    // The invoice auto-pays from the test account's balance — no on-chain
    // steps at all; empty tx hash renders the pay step without an explorer link.
    store().invoiceCreated({ ...invoiceParams, next: 'paying' });
    store().paymentSubmitted('');
    return;
  }

  if (isUsdc(token.address)) {
    store().invoiceCreated({ ...invoiceParams, next: 'paying' });
    await runPayment(config);
    return;
  }

  // Re-quote for the exact invoice price and check the allowance before
  // transitioning, so the machine enters `approving` only when it is needed.
  let quote: PaymentQuote;
  let approvalTx: Awaited<ReturnType<typeof checkApproval>>;
  try {
    quote = await fetchSwapQuote({
      swapper: address,
      tokenIn: token.address,
      amountOut: invoiceParams.paymentPrice,
    });
    const maxInput = quote.quote.input.maximumAmount ?? quote.quote.input.amount;
    approvalTx = await checkApproval({
      walletAddress: address,
      token: token.address,
      amount: maxInput,
    });
  } catch (error) {
    // Persist the invoice context first so retry can resume the swap step.
    store().invoiceCreated({ ...invoiceParams, next: 'swapping' });
    failWith('swap', error);
    return;
  }

  store().invoiceCreated({ ...invoiceParams, next: approvalTx ? 'approving' : 'swapping' });
  if (approvalTx && !(await runApproval(config, approvalTx))) return;
  if (!(await runSwap(config, address, quote))) return;
  await runPayment(config);
}

/** Re-entry points after a recoverable failure, keyed by the failed step. */
async function resumeFromStep(
  config: Config,
  address: Address,
  step: 'create_invoice' | 'approve' | 'swap' | 'pay'
): Promise<void> {
  if (step === 'create_invoice') {
    await runFromInvoice(config, address);
    return;
  }
  if (step === 'pay') {
    await runPayment(config);
    return;
  }
  // approve / swap: allowance may have changed — re-derive both.
  try {
    const quote = await fetchQuoteForPayment(address);
    const maxInput = quote.quote.input.maximumAmount ?? quote.quote.input.amount;
    const { token } = store();
    if (!token) return;
    const approvalTx = await checkApproval({
      walletAddress: address,
      token: token.address,
      amount: maxInput,
    });

    if (store().phase.status === 'approving') {
      if (approvalTx) {
        if (!(await runApproval(config, approvalTx))) return;
      } else {
        store().approveConfirmed('swapping');
      }
    }
    if (!(await runSwap(config, address, quote))) return;
    await runPayment(config);
  } catch (error) {
    failWith(step, error);
  }
}

export function useExecutePurchase() {
  const config = useConfig();
  const { address } = useAccount();

  /** Confirm from review: creates the invoice and drives the whole pipeline. */
  const start = useCallback(async () => {
    if (!address) return;
    if (store().phase.status !== 'review') return;
    store().confirmPurchase();
    await runFromInvoice(config, address);
  }, [config, address]);

  /** Retry a recoverable failure from the exact step that broke. */
  const retry = useCallback(async () => {
    if (!address) return;
    const phase = store().phase;
    if (phase.status !== 'failed' || !phase.recoverable) return;
    const step = phase.step;
    store().retryFromFailure();
    if (step === 'quote' || step === 'poll') return; // handled by their own hooks
    await resumeFromStep(config, address, step);
  }, [config, address]);

  return { start, retry };
}
