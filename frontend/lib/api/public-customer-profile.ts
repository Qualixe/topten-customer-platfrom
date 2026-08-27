import { apiGet, apiPatch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

/** Present only when the link came from a campaign SMS (a campaign-scoped
 * token) — an admin-issued token has no campaign, so this stays null. */
export interface PublicCustomerProfileCampaign {
  name: string;
  alreadyVerified: boolean;
}

/**
 * Shape returned by GET/PATCH /api/v1/public/customer-profile/{token}.
 * Deliberately excludes id, phone, total_spent, is_vip, and status — this
 * page must never expose or infer internal customer data.
 */
export interface PublicCustomerProfile {
  name: string;
  dateOfBirth: string | null;
  address: string | null;
  email: string | null;
  campaign: PublicCustomerProfileCampaign | null;
}

/**
 * The token is opaque — passed straight through as a path segment, never
 * decoded or interpreted here.
 */
export async function getPublicCustomerProfile(token: string): Promise<PublicCustomerProfile> {
  const envelope = await apiGet<ApiEnvelope<PublicCustomerProfile>>(
    `/public/customer-profile/${encodeURIComponent(token)}`
  );
  return envelope.data;
}

export interface UpdatePublicCustomerProfileInput {
  dateOfBirth: string;
  address: string;
  /** Omitted/blank leaves any existing email untouched — never clears it. */
  email?: string;
}

export async function updatePublicCustomerProfile(
  token: string,
  input: UpdatePublicCustomerProfileInput
): Promise<PublicCustomerProfile> {
  const envelope = await apiPatch<ApiEnvelope<PublicCustomerProfile>>(
    `/public/customer-profile/${encodeURIComponent(token)}`,
    {
      date_of_birth: input.dateOfBirth,
      address: input.address,
      email: input.email || undefined,
    }
  );
  return envelope.data;
}
