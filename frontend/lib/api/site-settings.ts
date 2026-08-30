import { API_BASE_URL, apiDelete, apiGet, apiPut, getAuthorizationHeader } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";
import { ApiError, NetworkError } from "@/lib/api/types";
import { DEFAULT_BRAND_COLOR } from "@/lib/theme/brand-color";

export { DEFAULT_BRAND_COLOR };

export interface SiteLogo {
  logoUrl: string | null;
  /** "#RRGGBB" — drives --primary/--ring app-wide, admin-editable in
   * Settings → General. */
  brandColor: string;
}

/** Reads the current logo URL and brand color — unauthenticated, since both
 * are shown on pages a logged-out visitor sees too (/login, public
 * customer/campaign profile pages). Upload/remove/update stay under the
 * protected /settings/* routes (see below). */
export async function getSiteLogo(): Promise<SiteLogo> {
  const envelope = await apiGet<ApiEnvelope<SiteLogo>>("/public/site-logo");
  return envelope.data;
}

/**
 * Resolved logo URL, or null on any failure. For chrome that renders on
 * every page (sidebar, mobile nav, public headers) — a logo lookup failure
 * must never break the page, just fall back to the default mark.
 */
export async function getResolvedLogoUrlSafe(): Promise<string | null> {
  try {
    const logo = await getSiteLogo();
    return resolveLogoUrl(logo.logoUrl);
  } catch {
    return null;
  }
}

/** Current brand color, or the default on any failure — used to inject the
 * app-wide --primary/--ring CSS variables in the root layout. A branding
 * lookup failure must never break the page, just fall back to the default. */
export async function getResolvedBrandColorSafe(): Promise<string> {
  try {
    const logo = await getSiteLogo();
    return logo.brandColor;
  } catch {
    return DEFAULT_BRAND_COLOR;
  }
}

export async function updateBrandColor(hex: string): Promise<SiteLogo> {
  const envelope = await apiPut<ApiEnvelope<SiteLogo>>("/settings/brand-color", {
    brand_color: hex,
  });
  return envelope.data;
}

/** Absolute URL for a logo path returned by the API (which is API-relative,
 * e.g. "/branding/abc.png") so `<img src>` resolves against the backend,
 * not the frontend's own origin. */
export function resolveLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  const apiOrigin = new URL(API_BASE_URL).origin;
  return `${apiOrigin}${logoUrl}`;
}

/** Uploads a new logo (multipart, not JSON) and returns its resulting URL. */
export async function uploadSiteLogo(file: File): Promise<SiteLogo> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    const authHeader = await getAuthorizationHeader();
    response = await fetch(`${API_BASE_URL}/settings/logo`, {
      method: "PUT",
      headers: authHeader,
      body: formData,
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = body || response.statusText;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      message = parsed.detail ?? message;
    } catch {
      // Not JSON — fall back to the raw text/status above.
    }
    throw new ApiError(message, response.status);
  }

  // Raw `fetch`, not `apiFetch` — the response is still backend snake_case,
  // unlike every other function here which goes through `apiFetch`'s
  // automatic camelization.
  const envelope = (await response.json()) as ApiEnvelope<{
    logo_url: string | null;
    brand_color: string;
  }>;
  return { logoUrl: envelope.data.logo_url, brandColor: envelope.data.brand_color };
}

export async function removeSiteLogo(): Promise<SiteLogo> {
  const envelope = await apiDelete<ApiEnvelope<SiteLogo>>("/settings/logo");
  return envelope.data;
}
