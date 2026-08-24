import type { SmsAccount } from "@/lib/mock/sms-account";

export type { SmsAccount } from "@/lib/mock/sms-account";
export { formatCurrency } from "@/lib/mock/sms-account";

/** Below this, `SmsBalanceCard` shows a low-balance warning. No provider
 * equivalent exists — this is a fixed UI threshold, same as the mock data
 * it replaces. */
const LOW_BALANCE_THRESHOLD = 2000;

/** Extends the base `SmsAccount` with why the balance couldn't be trusted,
 * if it couldn't — kept separate from `balanceCredits` (which stays 0 in
 * that case) so a real, alarming "zero balance" reading is never confused
 * with "we don't actually know the balance". */
export interface SmsAccountWithStatus extends SmsAccount {
  balanceError: string | null;
}

/**
 * The SMS gateway is generic (see Settings → API Credentials) — the admin
 * supplies any provider's send-SMS URL, but there's no equivalently generic
 * balance-check convention across providers the way there is for sending,
 * so this deliberately never calls out to check one. Always returns a
 * fixed "not available" state rather than a live value.
 */
export async function getSmsAccount(): Promise<SmsAccountWithStatus> {
  return {
    balanceCredits: 0,
    ratePerSegmentBdt: 0,
    lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
    balanceError:
      "Balance isn't available for a generic SMS gateway — check your provider's dashboard directly.",
  };
}
