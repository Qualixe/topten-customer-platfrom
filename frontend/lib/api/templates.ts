import { apiDelete, apiGet, apiPatch, apiPost, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope, PaginatedResponse } from "@/lib/api/types";

export type TemplateChannel = "SMS" | "EMAIL";
export type TemplateCategory =
  | "PROMOTIONAL"
  | "BIRTHDAY"
  | "VIP"
  | "PROFILE_COMPLETION"
  | "GENERAL";

export interface MessageTemplate {
  id: string;
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListTemplatesParams {
  page?: number;
  pageSize?: number;
  channel?: TemplateChannel;
  search?: string;
}

const DEFAULT_PAGE_SIZE = 50;

export async function listTemplates(
  params: ListTemplatesParams = {}
): Promise<PaginatedResponse<MessageTemplate>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const query = buildQueryString({
    page,
    page_size: pageSize,
    channel: params.channel,
    search: params.search?.trim() || undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<MessageTemplate>>(`/message-templates${query}`);

  return {
    items: envelope.data,
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export async function getTemplate(id: string): Promise<MessageTemplate> {
  const envelope = await apiGet<ApiEnvelope<MessageTemplate>>(`/message-templates/${id}`);
  return envelope.data;
}

export interface CreateTemplateInput {
  name: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  /** Required when channel is EMAIL, ignored for SMS. */
  subject?: string;
  body: string;
}

export async function createTemplate(input: CreateTemplateInput): Promise<MessageTemplate> {
  const envelope = await apiPost<ApiEnvelope<MessageTemplate>>("/message-templates", {
    name: input.name,
    channel: input.channel,
    category: input.category,
    subject: input.channel === "EMAIL" ? input.subject : undefined,
    body: input.body,
  });
  return envelope.data;
}

export interface UpdateTemplateInput {
  name?: string;
  category?: TemplateCategory;
  subject?: string;
  body?: string;
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<MessageTemplate> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.category !== undefined) body.category = input.category;
  if (input.subject !== undefined) body.subject = input.subject;
  if (input.body !== undefined) body.body = input.body;

  const envelope = await apiPatch<ApiEnvelope<MessageTemplate>>(`/message-templates/${id}`, body);
  return envelope.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiDelete<void>(`/message-templates/${id}`);
}
