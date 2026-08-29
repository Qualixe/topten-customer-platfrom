import { apiDelete, apiGet, apiPatch, apiPost, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope, PaginatedResponse } from "@/lib/api/types";
import type { FormBuilderData } from "@/lib/form-builder/types";

const DEFAULT_PAGE_SIZE = 20;

export type FormStatus = "DRAFT" | "PUBLISHED";

export interface FormRecord {
  id: string;
  name: string;
  description: string;
  /** Read-only — derived from `published` on the backend (Form.status),
   * always PUBLISHED once `published` is true. Not independently settable. */
  status: FormStatus;
  builderData: FormBuilderData;
  /** Set once the admin publishes this form as an open, tokenless public
   * form at /form/{slug} (see PublishOpenFormDialog) — independent of
   * attaching it to a campaign. Null until then. */
  slug: string | null;
  published: boolean;
  updatedAt: string;
}

export interface ListFormsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function listForms(params: ListFormsParams = {}): Promise<PaginatedResponse<FormRecord>> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? DEFAULT_PAGE_SIZE,
    search: params.search?.trim() || undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<FormRecord>>(`/forms${query}`);
  return {
    items: envelope.data,
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export async function getForm(id: string): Promise<FormRecord> {
  const envelope = await apiGet<ApiEnvelope<FormRecord>>(`/forms/${id}`);
  return envelope.data;
}

export async function createForm(name: string, description: string): Promise<FormRecord> {
  const envelope = await apiPost<ApiEnvelope<FormRecord>>("/forms", { name, description });
  return envelope.data;
}

export async function updateForm(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    builderData: FormBuilderData;
    slug: string;
    published: boolean;
  }>
): Promise<FormRecord> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.builderData !== undefined) body.builder_data = input.builderData;
  if (input.slug !== undefined) body.slug = input.slug;
  if (input.published !== undefined) body.published = input.published;

  const envelope = await apiPatch<ApiEnvelope<FormRecord>>(`/forms/${id}`, body);
  return envelope.data;
}

export async function deleteForm(id: string): Promise<void> {
  await apiDelete<void>(`/forms/${id}`);
}

export async function duplicateForm(id: string): Promise<FormRecord> {
  const envelope = await apiPost<ApiEnvelope<FormRecord>>(`/forms/${id}/duplicate`, {});
  return envelope.data;
}

export interface AttachFormResult {
  landingPageSlug: string;
  skippedFieldLabels: string[];
}

/** Copies a form's fields into a campaign's landing page — creating it if
 * needed — so the form can actually be sent via SMS and verify customers,
 * reusing the existing landing page/token/verification pipeline. The page
 * is always left unpublished; publish it from the campaign's landing page
 * builder after reviewing it. */
export async function attachFormToCampaign(
  formId: string,
  campaignId: string
): Promise<AttachFormResult> {
  const envelope = await apiPost<{
    data: { slug: string };
    meta: { skippedFieldLabels?: string[] };
  }>(`/sms/campaigns/${campaignId}/landing-page/from-form/${formId}`, {});
  return {
    landingPageSlug: envelope.data.slug,
    skippedFieldLabels: envelope.meta.skippedFieldLabels ?? [],
  };
}

export interface PublicForm {
  name: string;
  builderData: FormBuilderData;
}

/** Content only — no internal id, status, or anything else — for the
 * public, tokenless /form/[slug] page. */
export async function getPublicForm(slug: string): Promise<PublicForm> {
  const envelope = await apiGet<ApiEnvelope<PublicForm>>(`/public/forms/${encodeURIComponent(slug)}`);
  return envelope.data;
}

export interface GenericFormSubmissionInput {
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  address?: string;
}

/** No token — anyone can submit. Finds or creates a Customer by phone
 * rather than updating one already identified by a token; see
 * updatePublicCustomerProfile in public-customer-profile.ts for that other
 * flow. */
export async function submitGenericForm(slug: string, input: GenericFormSubmissionInput): Promise<void> {
  await apiPost<ApiEnvelope<Record<string, never>>>(`/public/forms/${encodeURIComponent(slug)}/submit`, {
    name: input.name,
    phone: input.phone,
    email: input.email || undefined,
    date_of_birth: input.dateOfBirth || undefined,
    address: input.address || undefined,
  });
}
