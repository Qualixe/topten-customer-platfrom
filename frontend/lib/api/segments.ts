import { apiGet } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export interface SegmentBucket {
  value: string;
  label: string;
  count: number;
}

export interface CustomerSegments {
  byStatus: SegmentBucket[];
  /** VIP vs Regular, from `is_vip` — not the unused `customer_type` enum
   * (every customer is currently GENERAL). */
  byTier: SegmentBucket[];
}

/**
 * Fetches `GET /api/v1/customers/segments` — live counts for the audience
 * breakdowns the schema actually supports (status, VIP tier). City,
 * gender, group, and tag aren't stored yet, so this response has no fields
 * for them; the Segments page renders those dimensions as "No data yet"
 * placeholders itself rather than the API faking empty data.
 */
export async function getCustomerSegments(): Promise<CustomerSegments> {
  const envelope = await apiGet<ApiEnvelope<CustomerSegments>>("/customers/segments");
  return envelope.data;
}
