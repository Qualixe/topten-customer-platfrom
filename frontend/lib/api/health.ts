import { apiGet } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export interface HealthStatus {
  status: string;
  service: string;
}

export async function checkApiHealth(): Promise<HealthStatus> {
  const envelope = await apiGet<ApiEnvelope<HealthStatus>>("/health");
  return envelope.data;
}
