import { AUTH_COOKIE_NAME, apiGet, apiPost } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export { AUTH_COOKIE_NAME };

export interface AuthUser {
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

interface LoginDataDto {
  token: string;
  user: AuthUser;
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days — matches the backend's JWT_EXPIRE_MINUTES default.

/** Signs in and stores the token in a plain (non-httpOnly) cookie so both
 * client components and Proxy can read it. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const envelope = await apiPost<ApiEnvelope<LoginDataDto>>("/auth/login", { email, password });
  const { token, user } = envelope.data;
  // Secure only over https — added conditionally so local http dev (where
  // the browser would otherwise silently refuse to store the cookie) keeps
  // working, while anything deployed over https gets the flag automatically.
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  return user;
}

/** Clears the auth cookie. There's no backend logout endpoint — JWTs here
 * are stateless, so "logging out" is purely discarding the local copy. */
export function logout(): void {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const envelope = await apiGet<ApiEnvelope<AuthUser>>("/auth/me");
  return envelope.data;
}

/** Same call as `getCurrentUser`, but resolves to `null` instead of
 * throwing — for chrome that renders on every page and must never crash
 * just because the caller is logged out or the token expired. */
export async function getCurrentUserSafe(): Promise<AuthUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiPost<void>("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
