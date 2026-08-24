import { API_BASE_URL, apiDelete, apiGet } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";
import { ApiError, NetworkError } from "@/lib/api/types";

export interface SiteLogo {
  logoUrl: string | null;
}

export async function getSiteLogo(): Promise<SiteLogo> {
  const envelope = await apiGet<ApiEnvelope<SiteLogo>>("/settings/logo");
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
    response = await fetch(`${API_BASE_URL}/settings/logo`, {
      method: "PUT",
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

  const envelope = (await response.json()) as ApiEnvelope<{ logo_url: string | null }>;
  return { logoUrl: envelope.data.logo_url };
}

export async function removeSiteLogo(): Promise<SiteLogo> {
  const envelope = await apiDelete<ApiEnvelope<SiteLogo>>("/settings/logo");
  return envelope.data;
}
