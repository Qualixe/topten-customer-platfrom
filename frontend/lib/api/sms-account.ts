import { getSmsGatewayBalance, getSmsGatewayCredentials } from "@/lib/api/integration-credentials";
import { getErrorMessage } from "@/lib/api/types";
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
 * Fetches the current SMS balance (live, from the configured gateway's
 * balance endpoint — see Settings → API Credentials) and pricing (the
 * admin-configured rate override) for cost estimation. Never throws — the
 * campaigns dashboard awaits this inside `Promise.all` in a server
 * component, so a provider-side failure (no balance URL configured, bad
 * key, unreachable) surfaces as `balanceError` instead of a broken page
 * render.
 */
export async function getSmsAccount(): Promise<SmsAccountWithStatus> {
  const [balanceResult, ratePerSegmentBdt] = await Promise.all([
    getSmsGatewayBalance().catch((err: unknown) => ({
      balance: null,
      success: false,
      httpStatus: 0,
      message: getErrorMessage(err, "Unable to reach the API server."),
    })),
    getSmsGatewayCredentials()
      .then((credentials) => Number(credentials.ratePerSegmentBdt.value ?? 0))
      .catch(() => 0),
  ]);

  // A successful call with no parseable balance (recognized field missing
  // from the response) is still "we don't actually know the balance" —
  // must not read as a real, alarming zero.
  const balanceKnown = balanceResult.success && balanceResult.balance !== null;

  return {
    balanceCredits: balanceKnown ? (balanceResult.balance as number) : 0,
    ratePerSegmentBdt,
    lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
    balanceError: balanceKnown
      ? null
      : balanceResult.message || "Unable to fetch balance.",
  };
}
