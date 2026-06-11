/** Captured from live v2 probes on 2026-06-11 (ids shortened). */

export const productResponseFixture = {
  meta: { id: 'test-gift-card-code', _endpoint: '/products/test-gift-card-code' },
  data: {
    id: 'test-gift-card-code',
    name: 'Test Gift Card Code',
    country_code: 'KN',
    country_name: 'St Kitts and Nevis',
    currency: 'USD',
    categories: ['gifts'],
    created_time: '2021-10-21T12:04:11.677Z',
    recipient_type: 'none',
    image: 'us',
    in_stock: true,
    range: { min: 10, max: 100, step: 10, price_rate: 1666.3288830618062 },
    packages: [
      { id: 'test-gift-card-code<&>10', value: '10', price: 16664, amount: 10 },
      { id: 'test-gift-card-code<&>20', value: '20', price: 33327, amount: 20 },
      { id: 'test-gift-card-code<&>100', value: '100', price: 166633, amount: 100 },
    ],
  },
};

export const invoiceResponseFixture = {
  meta: { _endpoint: '/invoices' },
  data: {
    id: 'aa52049e-5a4b-451c-bd51-9807778eeef9',
    created_time: '2026-06-11T12:13:17.573Z',
    status: 'not_delivered',
    user: { id: 'u-1', email: 'test@example.com' },
    payment: {
      method: 'usdc_base',
      address: '0x46968d7257d41159D37048CEDA686E2A0A8E8A89',
      currency: 'USDC',
      price: 10500000,
      status: 'unpaid',
      commission: 0,
    },
    orders: [
      {
        id: '6a2aa65dabde95de17c336f8',
        status: 'created',
        product: {
          id: 'test-gift-card-code',
          name: 'Test Gift Card Code',
          value: '10',
          currency: 'USD',
          image: 'us',
        },
        created_time: '2026-06-11T12:13:17.551Z',
        delivered_time: null,
        commission: 0,
      },
    ],
  },
};

export const orderResponseFixture = {
  meta: { id: '6a2aa65dabde95de17c336f8', _endpoint: '/orders/6a2aa65dabde95de17c336f8' },
  data: {
    id: '6a2aa65dabde95de17c336f8',
    status: 'created',
    product: {
      id: 'test-gift-card-code',
      name: 'Test Gift Card Code',
      value: '10',
      currency: 'USD',
      image: 'us',
    },
    created_time: '2026-06-11T12:13:17.551Z',
    delivered_time: null,
    commission: 0,
    user: { id: 'u-1', email: 'test@example.com' },
    invoice: { id: 'aa52049e-5a4b-451c-bd51-9807778eeef9' },
  },
};

/** Balance-paid (demo) invoice: payment has NO address field. Captured 2026-06-12. */
export const balanceInvoiceResponseFixture = {
  meta: { _endpoint: '/invoices' },
  data: {
    id: 'c9e41c39-5259-47d9-9c23-a378355aae06',
    created_time: '2026-06-12T09:29:08.441Z',
    status: 'not_delivered',
    user: { id: 'u-1', email: 'test@example.com' },
    payment: {
      method: 'balance',
      price: 16496,
      currency: 'BTC',
      status: 'unpaid',
      commission: 0,
    },
    orders: [
      {
        id: '6a2bd164cf7d62ccaa17a554',
        status: 'created',
        product: {
          id: 'test-gift-card-code',
          name: 'Test Gift Card Code',
          value: '10',
          currency: 'USD',
          image: 'us',
        },
        created_time: '2026-06-12T09:29:08.496Z',
        delivered_time: null,
        commission: 0,
      },
    ],
  },
};

/** Real delivered order captured 2026-06-12 (balance auto_pay test purchase). */
export const deliveredOrderResponseFixture = {
  meta: {},
  data: {
    ...orderResponseFixture.data,
    status: 'delivered',
    delivered_time: '2026-06-12T09:29:08.783Z',
    redemption_info: {
      code: '7979451508286322',
      instructions: 'This field will contain instructions on how to redeem the voucher.',
      other: 'This field will contain other relevant information like expiration date.',
      extra_fields: {},
    },
  },
};
