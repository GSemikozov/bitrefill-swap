import { z } from 'zod';

/** Built per-render: the allowed values come from the product endpoint. */
export function createDenominationSchema(denominations: number[]) {
  return z.object({
    denomination: z
      .number({ error: 'Pick a gift card amount' })
      .refine((value) => denominations.includes(value), {
        message: 'Pick one of the available amounts',
      }),
  });
}

export type DenominationFormValues = z.infer<ReturnType<typeof createDenominationSchema>>;

export type AffordabilityProblem = 'balance' | 'gas';

/**
 * Can the wallet cover the worst-case input? For native ETH the input also
 * competes with gas, so a reserve is required on top.
 */
export function checkAffordability(params: {
  balance: bigint;
  maxInput: bigint;
  isNative: boolean;
  gasReserve: bigint;
}): AffordabilityProblem | null {
  const { balance, maxInput, isNative, gasReserve } = params;
  if (maxInput > balance) return 'balance';
  if (isNative && maxInput + gasReserve > balance) return 'gas';
  return null;
}
