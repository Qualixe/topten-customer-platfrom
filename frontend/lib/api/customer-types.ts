import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope } from "@/lib/api/types";

/** Customer types are admin-managed rows (see `listCustomerTypes` etc.
 * below), not a fixed list. The three seeded ones (General/VIP/VVIP) are
 * `isSystem: true` — they can never be renamed or deactivated, since SMS
 * campaign audience targeting resolves them by exact name. There is no
 * delete for any type, system or admin-created — only `isActive`, so a
 * type stays permanently valid for the customers/import batches already
 * referencing it. */
export interface CustomerTypeOption {
  id: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
}

/** Fetches the admin-managed customer type list, sorted by name. */
export async function listCustomerTypes(): Promise<CustomerTypeOption[]> {
  const envelope = await apiGet<ApiListEnvelope<CustomerTypeOption>>("/customers/types");
  return envelope.data;
}

/** Throws `ApiError` (422) if the name is already taken. */
export async function createCustomerType(name: string): Promise<CustomerTypeOption> {
  const envelope = await apiPost<ApiEnvelope<CustomerTypeOption>>("/customers/types", { name });
  return envelope.data;
}

/** Throws `ApiError` (422) if the type is a built-in (`isSystem`) one, or if
 * the new name is already taken. */
export async function updateCustomerType(id: string, name: string): Promise<CustomerTypeOption> {
  const envelope = await apiPatch<ApiEnvelope<CustomerTypeOption>>(`/customers/types/${id}`, {
    name,
  });
  return envelope.data;
}

/** Throws `ApiError` (422) if `isActive: false` is sent for a built-in
 * (`isSystem`) type — those can never be deactivated. */
export async function setCustomerTypeActive(
  id: string,
  isActive: boolean
): Promise<CustomerTypeOption> {
  const envelope = await apiPatch<ApiEnvelope<CustomerTypeOption>>(`/customers/types/${id}`, {
    is_active: isActive,
  });
  return envelope.data;
}
