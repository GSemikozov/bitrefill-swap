export const QUERY_KEYS = {
  bitrefill: {
    product: (productId: string) => ['bitrefill', 'product', productId] as const,
    invoice: (invoiceId?: string) => ['bitrefill', 'invoice', invoiceId] as const,
    order: (orderId?: string) => ['bitrefill', 'order', orderId] as const,
  },
  uniswap: {
    quote: (tokenIn?: string, amountOut?: string) =>
      ['uniswap', 'quote', tokenIn, amountOut] as const,
  },
  tokens: {
    held: (owner?: string, demo?: boolean) => ['tokens', 'held', owner, demo] as const,
  },
} as const;
