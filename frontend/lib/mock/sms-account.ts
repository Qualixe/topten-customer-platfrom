export interface SmsAccount {
  balanceCredits: number;
  ratePerSegmentBdt: number;
  lowBalanceThreshold: number;
}

export const mockSmsAccount: SmsAccount = {
  balanceCredits: 12480,
  ratePerSegmentBdt: 0.45,
  lowBalanceThreshold: 2000,
};

export function formatCurrency(value: number) {
  return `৳${value.toLocaleString("en-US")}`;
}
