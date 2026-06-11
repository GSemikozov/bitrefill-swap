/** Captured from live Trading API probes on 2026-06-11 (trimmed to relevant fields + extras). */

export const quoteResponseFixture = {
  requestId: 'req-1',
  routing: 'CLASSIC',
  permitData: null,
  permitTransaction: null,
  quote: {
    chainId: 8453,
    swapper: '0x000000000000000000000000000000000000dEaD',
    tradeType: 'EXACT_OUTPUT',
    route: [[{ type: 'v3-pool' }]],
    input: {
      amount: '6374404285754679',
      token: '0x0000000000000000000000000000000000000000',
      maximumAmount: '6406276307183452',
    },
    output: {
      amount: '10500000',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: '0x000000000000000000000000000000000000dEaD',
      minimumAmount: '10500000',
    },
    slippage: 0.5,
    priceImpact: 0.02,
    gasFee: '3313343808480',
    // A string on purpose: the live API flips this field between number and
    // string across calls (observed 2026-06-12), and /swap rejects any
    // mutation of the quote — the schema must not coerce it.
    gasFeeUSD: '0.005521526219012081',
    gasUseEstimate: '497052',
    routeString: 'ETH → USDC',
    blockNumber: '12345',
    quoteId: '8da914ef-27dc-4e2e-9071-1d4a1600fa84',
    maxFeePerGas: '6666725',
    maxPriorityFeePerGas: '1666725',
  },
};

export const approvalNeededResponseFixture = {
  requestId: 'req-2',
  approval: {
    to: '0x4200000000000000000000000000000000000006',
    from: '0x000000000000000000000000000000000000dEaD',
    data: '0x095ea7b3000000000000000000000000000000000022d473030f116ddee9f6b43ac78ba3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    value: '0x00',
    chainId: 8453,
  },
  cancel: null,
};

export const approvalNotNeededResponseFixture = {
  requestId: 'req-3',
  approval: null,
  cancel: null,
};

export const swapResponseFixture = {
  requestId: 'req-4',
  gasFee: '3313343808480',
  swap: {
    to: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    from: '0x000000000000000000000000000000000000dEaD',
    data: '0x3593564c0000',
    value: '0x16c2796f9f675c',
    // The live API returns chainId as a string here — schema must coerce.
    chainId: '8453',
    gasLimit: '555282',
    maxFeePerGas: '6666725',
    maxPriorityFeePerGas: '1666725',
  },
  signature: null,
  publicKeyId: null,
};
