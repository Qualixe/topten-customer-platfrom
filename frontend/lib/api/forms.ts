import { apiDelete, apiGet, apiPatch, apiPost, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope, PaginatedResponse } from "@/lib/api/types";
import type { FormBuilderData } from "@/lib/form-builder/types";

const DEFAULT_PAGE_SIZE = 20;

export type FormStatus = "DRAFT" | "PUBLISHED";

export interface FormRecord {
  id: string;
  name: string;
  description: string;
  status: FormStatus;
  builderData: FormBuilderData;
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
  input: Partial<{ name: string; description: string; status: FormStatus; builderData: FormBuilderData }>
): Promise<FormRecord> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.status !== undefined) body.status = input.status;
  if (input.builderData !== undefined) body.builder_data = input.builderData;

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
