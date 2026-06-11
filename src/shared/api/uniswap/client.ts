import { BASE_CHAIN_ID, NATIVE_TOKEN_ADDRESS, USDC_BASE_ADDRESS } from '@shared/config';
import type { Address } from 'viem';
import { apiRequest } from '../client';
import {
  type ApprovalCheckResponse,
  approvalCheckResponseSchema,
  type QuoteResponse,
  quoteResponseSchema,
  type SwapResponse,
  swapResponseSchema,
  type UniswapTxRequest,
} from './schemas';

// Same-origin proxy (Vite dev proxy / Netlify edge function) injects x-api-key:
// the trade-api gateway only serves CORS for localhost origins, so direct
// browser calls break in production — and the key stays out of the bundle.
const TRADING_API_BASE = '/api/uniswap/v1';

export interface CheckApprovalParams {
  walletAddress: Address;
  token: Address;
  /** Worst-case input amount in the token's base units. */
  amount: string;
}

/**
 * Returns the Permit2 approval transaction to send, or null when no approval
 * is needed (sufficient allowance, or native ETH which never needs one).
 */
export async function checkApproval(params: CheckApprovalParams): Promise<UniswapTxRequest | null> {
  if (params.token === NATIVE_TOKEN_ADDRESS) return null;

  const response: ApprovalCheckResponse = await apiRequest(`${TRADING_API_BASE}/check_approval`, {
    method: 'POST',
    body: {
      walletAddress: params.walletAddress,
      token: params.token,
      amount: params.amount,
      chainId: BASE_CHAIN_ID,
    },
    schema: approvalCheckResponseSchema,
  });
  return response.approval;
}

export interface QuoteParams {
  swapper: Address;
  tokenIn: Address;
  /** Exact USDC amount to receive, in base units (6 decimals). */
  amountOut: string;
}

/** EXACT_OUTPUT quote: the user receives exactly `amountOut` USDC on Base. */
export async function fetchSwapQuote(params: QuoteParams): Promise<QuoteResponse> {
  return apiRequest(`${TRADING_API_BASE}/quote`, {
    method: 'POST',
    body: {
      type: 'EXACT_OUTPUT',
      amount: params.amountOut,
      tokenIn: params.tokenIn,
      tokenInChainId: BASE_CHAIN_ID,
      tokenOut: USDC_BASE_ADDRESS,
      tokenOutChainId: BASE_CHAIN_ID,
      swapper: params.swapper,
      routingPreference: 'BEST_PRICE',
    },
    schema: quoteResponseSchema,
  });
}

export interface BuildSwapParams {
  quoteResponse: QuoteResponse;
  /** EIP-712 signature over quoteResponse.permitData, when the API requested one. */
  permitSignature?: string;
}

/** Exchanges a quote for ready-to-send transaction calldata. */
export async function buildSwapTransaction(params: BuildSwapParams): Promise<UniswapTxRequest> {
  const { quoteResponse, permitSignature } = params;
  const response: SwapResponse = await apiRequest(`${TRADING_API_BASE}/swap`, {
    method: 'POST',
    body: {
      quote: quoteResponse.quote,
      ...(quoteResponse.permitData && permitSignature
        ? { permitData: quoteResponse.permitData, signature: permitSignature }
        : {}),
      simulateTransaction: false,
    },
    schema: swapResponseSchema,
  });
  return response.swap;
}
