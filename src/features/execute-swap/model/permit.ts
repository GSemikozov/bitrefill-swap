import type { Config } from 'wagmi';
import { signTypedData } from 'wagmi/actions';

interface PermitDataShape {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  values: Record<string, unknown>;
}

function isPermitData(value: unknown): value is PermitDataShape {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.domain && record.types && record.values);
}

/**
 * Permit2 signature-only authorization: the quote's `permitData` is an EIP-712
 * payload the wallet signs without an on-chain transaction.
 */
export async function signPermit(config: Config, permitData: unknown): Promise<`0x${string}`> {
  if (!isPermitData(permitData)) {
    throw new Error('Malformed permit data in the swap quote');
  }
  const primaryType = Object.keys(permitData.types).find((key) => key !== 'EIP712Domain');
  if (!primaryType) {
    throw new Error('Malformed permit data in the swap quote');
  }
  return signTypedData(config, {
    // biome-ignore lint/suspicious/noExplicitAny: payload shape is defined by the Uniswap API
    domain: permitData.domain as any,
    // biome-ignore lint/suspicious/noExplicitAny: payload shape is defined by the Uniswap API
    types: permitData.types as any,
    primaryType,
    // biome-ignore lint/suspicious/noExplicitAny: payload shape is defined by the Uniswap API
    message: permitData.values as any,
  });
}
