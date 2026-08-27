import { apiDelete, apiGet, apiPatch, apiPost, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope } from "@/lib/api/types";

export type SmsCampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** What kind of campaign this is — independent of who it targets. Used by
 * the NEVER_RECEIVED_TYPE / RECEIVED_TYPE_BEFORE_DATE audience rules to
 * look back at campaign history by category. */
export type CampaignType =
  | "PROFILE_COMPLETION"
  | "PROMOTIONAL"
  | "BIRTHDAY"
  | "VIP"
  | "VVIP"
  | "GENERAL";

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  PROFILE_COMPLETION: "Profile completion",
  PROMOTIONAL: "Promotional",
  BIRTHDAY: "Birthday",
  VIP: "VIP",
  VVIP: "VVIP",
  GENERAL: "General",
};

export type AudienceRuleType =
  | "GENERAL"
  | "VIP"
  | "VVIP"
  | "NEW_SINCE_DATE"
  | "MISSING_DOB"
  | "MISSING_ADDRESS"
  | "MISSING_DOB_AND_ADDRESS"
  | "NEVER_RECEIVED_TYPE"
  | "RECEIVED_TYPE_BEFORE_DATE"
  | "SPECIFIC_CUSTOMERS"
  | "NEVER_VERIFIED"
  | "TARGETED_NOT_VERIFIED";

type NoParamRuleType =
  | "GENERAL"
  | "VIP"
  | "VVIP"
  | "MISSING_DOB"
  | "MISSING_ADDRESS"
  | "MISSING_DOB_AND_ADDRESS"
  | "NEVER_VERIFIED"
  | "TARGETED_NOT_VERIFIED";

/** Which customers a campaign targets. A discriminated union since four of
 * the rule types need extra input the others don't — see backend
 * app.modules.sms_campaigns.audience.AudienceRule. */
export type AudienceRule =
  | { ruleType: NoParamRuleType }
  | { ruleType: "NEW_SINCE_DATE"; sinceDate: string }
  | { ruleType: "NEVER_RECEIVED_TYPE"; campaignType: CampaignType }
  | { ruleType: "RECEIVED_TYPE_BEFORE_DATE"; campaignType: CampaignType; beforeDate: string }
  | { ruleType: "SPECIFIC_CUSTOMERS"; customerIds: string[] };

function audienceRuleToQueryParams(rule: AudienceRule): Record<string, string> {
  const params: Record<string, string> = { rule_type: rule.ruleType };
  if (rule.ruleType === "NEW_SINCE_DATE") params.since_date = rule.sinceDate;
  if (rule.ruleType === "NEVER_RECEIVED_TYPE") params.campaign_type = rule.campaignType;
  if (rule.ruleType === "RECEIVED_TYPE_BEFORE_DATE") {
    params.campaign_type = rule.campaignType;
    params.before_date = rule.beforeDate;
  }
  return params;
}

export interface SmsCampaign {
  id: string;
  name: string;
  campaignType: CampaignType;
  audienceRuleType: AudienceRuleType;
  /** Camelized params for the rule above — e.g. { sinceDate: "2026-08-19" }
   * or { campaignType: "PROFILE_COMPLETION", beforeDate: "2026-08-19" }. */
  audienceRuleParams: Record<string, string>;
  message: string;
  senderId: string;
  /** Always server-computed — never trust a client-supplied value for this. */
  totalRecipients: number;
  smsSegments: number;
  estimatedCost: number;
  scheduledAt: string | null;
  status: SmsCampaignStatus;
  /** Null while the recipient snapshot is still resolving in the
   * background — totalRecipients/estimatedCost aren't trustworthy yet. */
  recipientsResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Shape of one campaign after `camelizeKeys`. */
interface SmsCampaignDto {
  id: string;
  name: string;
  campaignType: CampaignType;
  audienceRuleType: AudienceRuleType;
  audienceRuleParams: Record<string, string>;
  message: string;
  senderId: string;
  totalRecipients: number;
  smsSegments: number;
  estimatedCost: string | number;
  scheduledAt: string | null;
  status: SmsCampaignStatus;
  recipientsResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapDtoToCampaign(dto: SmsCampaignDto): SmsCampaign {
  return {
    id: dto.id,
    name: dto.name,
    campaignType: dto.campaignType,
    audienceRuleType: dto.audienceRuleType,
    audienceRuleParams: dto.audienceRuleParams,
    message: dto.message,
    senderId: dto.senderId,
    totalRecipients: dto.totalRecipients,
    smsSegments: dto.smsSegments,
    estimatedCost: Number(dto.estimatedCost),
    scheduledAt: dto.scheduledAt,
    status: dto.status,
    recipientsResolvedAt: dto.recipientsResolvedAt,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export interface ListCampaignsParams {
  page?: number;
  pageSize?: number;
  status?: SmsCampaignStatus | "all";
  campaignType?: CampaignType | "all";
  search?: string;
}

export interface PaginatedCampaigns {
  items: SmsCampaign[];
  total: number;
  page: number;
  pageSize: number;
}

/** Fetches a page of campaigns, filtered/paginated server-side. */
export async function listCampaigns(
  params: ListCampaignsParams = {}
): Promise<PaginatedCampaigns> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? 20,
    status: params.status && params.status !== "all" ? params.status : undefined,
    campaign_type:
      params.campaignType && params.campaignType !== "all" ? params.campaignType : undefined,
    search: params.search?.trim() || undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<SmsCampaignDto>>(`/sms/campaigns${query}`);

  return {
    items: envelope.data.map(mapDtoToCampaign),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export async function getCampaign(id: string): Promise<SmsCampaign> {
  const envelope = await apiGet<ApiEnvelope<SmsCampaignDto>>(`/sms/campaigns/${id}`);
  return mapDtoToCampaign(envelope.data);
}

export interface CreateCampaignInput {
  name: string;
  campaignType: CampaignType;
  audienceRule: AudienceRule;
  message: string;
  senderId: string;
  /** ISO datetime string. Omit for an unscheduled draft. */
  scheduledAt?: string;
  status?: SmsCampaignStatus;
}

/** Creates a real campaign via `POST /api/v1/sms/campaigns`. The audience
 * rule is stored and resolved into a frozen recipient snapshot in the
 * background — total_recipients/estimated_cost stay 0 until
 * `recipientsResolvedAt` is set (poll `getCampaign`). */
export async function createCampaign(input: CreateCampaignInput): Promise<SmsCampaign> {
  const rule = input.audienceRule;
  const audienceRuleBody: Record<string, unknown> = { rule_type: rule.ruleType };
  if (rule.ruleType === "NEW_SINCE_DATE") audienceRuleBody.since_date = rule.sinceDate;
  if (rule.ruleType === "NEVER_RECEIVED_TYPE") audienceRuleBody.campaign_type = rule.campaignType;
  if (rule.ruleType === "RECEIVED_TYPE_BEFORE_DATE") {
    audienceRuleBody.campaign_type = rule.campaignType;
    audienceRuleBody.before_date = rule.beforeDate;
  }
  if (rule.ruleType === "SPECIFIC_CUSTOMERS") audienceRuleBody.customer_ids = rule.customerIds;

  const envelope = await apiPost<ApiEnvelope<SmsCampaignDto>>("/sms/campaigns", {
    name: input.name,
    campaign_type: input.campaignType,
    audience_rule: audienceRuleBody,
    message: input.message,
    sender_id: input.senderId,
    scheduled_at: input.scheduledAt,
    status: input.status,
  });
  return mapDtoToCampaign(envelope.data);
}

/** Updates a campaign via `PATCH /api/v1/sms/campaigns/{id}`. `campaignType`
 * and `audienceRule` are deliberately not here — the recipient snapshot is
 * frozen at creation, so the backend rejects any attempt to change the rule
 * that produced it (422). */
export interface UpdateCampaignInput {
  name?: string;
  message?: string;
  senderId?: string;
  scheduledAt?: string | null;
  status?: SmsCampaignStatus;
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput
): Promise<SmsCampaign> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.message !== undefined) body.message = input.message;
  if (input.senderId !== undefined) body.sender_id = input.senderId;
  if (input.scheduledAt !== undefined) body.scheduled_at = input.scheduledAt;
  if (input.status !== undefined) body.status = input.status;

  const envelope = await apiPatch<ApiEnvelope<SmsCampaignDto>>(`/sms/campaigns/${id}`, body);
  return mapDtoToCampaign(envelope.data);
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiDelete<void>(`/sms/campaigns/${id}`);
}

export interface AudienceCounts {
  general: number;
  vip: number;
  vvip: number;
  missingDob: number;
  missingAddress: number;
  missingDobAndAddress: number;
  neverVerified: number;
  targetedNotVerified: number;
}

/** Live recipient counts for the six unparametrized audience rules,
 * computed server-side (SQL COUNT — no customer rows are loaded), for
 * previewing before a campaign is saved. The three parametrized rules
 * (NEW_SINCE_DATE, NEVER_RECEIVED_TYPE, RECEIVED_TYPE_BEFORE_DATE) aren't
 * included here since they need input first — see `getAudiencePreviewCount`. */
export async function getAudienceCounts(): Promise<AudienceCounts> {
  const envelope = await apiGet<ApiEnvelope<AudienceCounts>>("/sms/campaigns/audience-counts");
  return envelope.data;
}

/** Live count for any single audience rule, including the parametrized
 * ones — for previewing a rule's size before a campaign is created. */
export async function getAudiencePreviewCount(rule: AudienceRule): Promise<number> {
  const query = buildQueryString(audienceRuleToQueryParams(rule));
  const envelope = await apiGet<ApiEnvelope<{ count: number }>>(
    `/sms/campaigns/audience-preview${query}`
  );
  return envelope.data.count;
}

export interface AudiencePreviewRecipient {
  id: string;
  name: string;
  phone: string;
}

export interface PaginatedAudiencePreview {
  items: AudiencePreviewRecipient[];
  total: number;
  page: number;
  pageSize: number;
}

/** A bounded, paginated peek at *which* customers a rule would match —
 * nothing is created; the real snapshot is only frozen on `createCampaign`. */
export async function getAudiencePreviewRecipients(
  rule: AudienceRule,
  page = 1,
  pageSize = 20
): Promise<PaginatedAudiencePreview> {
  const query = buildQueryString({
    ...audienceRuleToQueryParams(rule),
    page,
    page_size: pageSize,
  });
  const envelope = await apiGet<ApiListEnvelope<AudiencePreviewRecipient>>(
    `/sms/campaigns/audience-preview-recipients${query}`
  );
  return {
    items: envelope.data,
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export type CampaignRecipientStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED";

export interface CampaignRecipient {
  id: string;
  customerId: string;
  phone: string;
  status: CampaignRecipientStatus;
  providerMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCampaignRecipients {
  items: CampaignRecipient[];
  total: number;
  page: number;
  pageSize: number;
}

/** The frozen recipient snapshot for one campaign — never a re-resolution
 * of the audience rule. */
export async function getCampaignRecipients(
  campaignId: string,
  page = 1,
  pageSize = 20
): Promise<PaginatedCampaignRecipients> {
  const query = buildQueryString({ page, page_size: pageSize });
  const envelope = await apiGet<ApiListEnvelope<CampaignRecipient>>(
    `/sms/campaigns/${campaignId}/recipients${query}`
  );
  return {
    items: envelope.data,
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export interface CampaignRecipientStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  verified: number;
  pendingVerification: number;
  /** 0-100, one decimal place. */
  verificationRate: number;
}

export async function getCampaignRecipientStats(
  campaignId: string
): Promise<CampaignRecipientStats> {
  const envelope = await apiGet<ApiEnvelope<CampaignRecipientStats>>(
    `/sms/campaigns/${campaignId}/stats`
  );
  return envelope.data;
}

export interface CampaignStats {
  total: number;
  draft: number;
  scheduled: number;
  processing: number;
  completed: number;
  failed: number;
}

/** No dedicated stats endpoint exists for the dashboard overview — each
 * figure is a real server-side COUNT (via `meta.total` on a `page_size: 1`
 * list call), same principle as `getAudienceCounts`, just six small
 * requests instead of a bespoke route. */
export async function getCampaignStats(): Promise<CampaignStats> {
  const [total, draft, scheduled, processing, completed, failed] = await Promise.all([
    listCampaigns({ pageSize: 1 }),
    listCampaigns({ pageSize: 1, status: "DRAFT" }),
    listCampaigns({ pageSize: 1, status: "SCHEDULED" }),
    listCampaigns({ pageSize: 1, status: "PROCESSING" }),
    listCampaigns({ pageSize: 1, status: "COMPLETED" }),
    listCampaigns({ pageSize: 1, status: "FAILED" }),
  ]);

  return {
    total: total.total,
    draft: draft.total,
    scheduled: scheduled.total,
    processing: processing.total,
    completed: completed.total,
    failed: failed.total,
  };
}
