import { z } from 'zod';

const hexString = z.custom<`0x${string}`>(
  (value) => typeof value === 'string' && value.startsWith('0x')
);

const txRequestSchema = z.looseObject({
  to: hexString,
  from: hexString,
  data: hexString,
  value: hexString,
  chainId: z.coerce.number(),
  gasLimit: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
});

export const approvalCheckResponseSchema = z.object({
  requestId: z.string(),
  /** null → allowance is already sufficient, no approval tx needed. */
  approval: txRequestSchema.nullable(),
  cancel: z.unknown().optional(),
});

/**
 * The `quote` object must be passed back to /swap verbatim, so it is loose:
 * we validate only the fields the UI reads and keep everything else intact.
 */
export const quoteResponseSchema = z.looseObject({
  requestId: z.string(),
  routing: z.string(),
  /** EIP-712 payload to sign when Permit2 permission is needed (null for native ETH). */
  permitData: z.unknown().nullable().optional(),
  quote: z.looseObject({
    chainId: z.number(),
    tradeType: z.string(),
    input: z.looseObject({
      token: z.string(),
      amount: z.string(),
      /** EXACT_OUTPUT: worst-case input after slippage — what balance checks must use. */
      maximumAmount: z.string().optional(),
    }),
    output: z.looseObject({
      token: z.string(),
      amount: z.string(),
      minimumAmount: z.string().optional(),
      recipient: z.string().optional(),
    }),
    // NEVER coerce inside the quote: it must round-trip to /swap byte-exact,
    // and the API itself flips these between number and string across calls.
    slippage: z.union([z.number(), z.string()]).optional(),
    priceImpact: z.union([z.number(), z.string()]).optional(),
    gasFeeUSD: z.union([z.number(), z.string()]).optional(),
    quoteId: z.string().optional(),
  }),
});

export const swapResponseSchema = z.object({
  requestId: z.string(),
  swap: txRequestSchema,
});

export type UniswapTxRequest = z.infer<typeof txRequestSchema>;
export type ApprovalCheckResponse = z.infer<typeof approvalCheckResponseSchema>;
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export type SwapResponse = z.infer<typeof swapResponseSchema>;
