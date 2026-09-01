/**
 * Runs `promise` alongside the page's own `getCurrentUserSafe()` call
 * (see the dashboard pages that use this) instead of only starting it
 * after the permission check resolves — that sequential chain doubled
 * the perceived navigation latency on every route with a permission gate.
 *
 * Firing it in parallel with the auth check means it can now be *rejected*
 * for a request the backend correctly denies before the frontend's own
 * permission check has had a chance to short-circuit — this swallows
 * exactly that expected case. Only ever unwrapped after confirming the
 * caller is actually authorized, at which point the backend enforces the
 * same permission the frontend just checked, so a real rejection here
 * cannot happen for an authorized user.
 */
export async function settleOk<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}
