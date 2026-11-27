export type PaymentEnvironment = 'disabled' | 'sandbox' | 'live';
export type PaymentMethod = {
  code: string;
  name: string;
  kind: 'wallet' | 'bank' | 'card';
  route: 'wallet_push' | 'hosted';
};
export type SubscriptionPaymentStatus =
  | 'creating'
  | 'awaiting_approval'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';
export type SubscriptionPaymentSummary = {
  id: string;
  amount: number;
  currency: 'TZS';
  periodMonths: 1 | 12;
  category: import('./index').Category;
  status: SubscriptionPaymentStatus;
  environment: 'sandbox' | 'live';
  simulated: boolean;
  paymentMethod: string;
  checkoutUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  reviewRequired: boolean;
  canRetry: boolean;
  providerReference: string | null;
  taxRate: number | string | null;
  receipt: null | {
    number: string;
    periodMonths: 1 | 12;
    gross: number;
    taxRate: number | string | null;
    taxPortion: number | null;
    coverageStart: string;
    coverageEnd: string;
  };
};
