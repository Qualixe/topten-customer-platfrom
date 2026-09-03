"use client";

import { useEffect, useState } from "react";

import { buildCsv, downloadCsvFile } from "@/lib/csv";
import { listCustomerTypes } from "@/lib/api/customer-types";
import {
  CAMPAIGN_TYPE_LABELS,
  type AudienceRuleType,
  type CampaignChannel,
  type CampaignType,
  type SmsCampaign,
} from "@/lib/api/campaigns";

/** Shared by the Campaigns page's own export button and the Reports page's
 * Campaign History card — same rows, same channel-aware CSV, two entry
 * points into the same data. */

export const AUDIENCE_LABELS: Record<AudienceRuleType, string> = {
  // Kept only so campaigns created before CUSTOMER_TYPE existed still show
  // a real label — see AudienceRuleType's docstring on the backend.
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
  CUSTOMER_TYPE: "Customer type",
  MISSING_DOB: "Missing DOB",
  MISSING_ADDRESS: "Missing Address",
  MISSING_DOB_AND_ADDRESS: "Missing DOB & Address",
  NEW_SINCE_DATE: "New since",
  NEVER_RECEIVED_TYPE: "Never received",
  RECEIVED_TYPE_BEFORE_DATE: "Received before",
  SPECIFIC_CUSTOMERS: "Specific customers",
  NEVER_VERIFIED: "Never verified",
  TARGETED_NOT_VERIFIED: "Targeted, not verified",
};

/** Resolves id -> name for CUSTOMER_TYPE rules' display — the backend only
 * stores `customer_type_id` on the campaign, not a name snapshot. A type
 * is never deleted (only deactivated), so the id always resolves. */
export function describeAudience(campaign: SmsCampaign, typeNames: Record<string, string>): string {
  const base = AUDIENCE_LABELS[campaign.audienceRuleType];
  const params = campaign.audienceRuleParams;

  if (campaign.audienceRuleType === "CUSTOMER_TYPE" && params.customerTypeId) {
    return typeNames[params.customerTypeId] ?? base;
  }
  if (campaign.audienceRuleType === "NEW_SINCE_DATE" && params.sinceDate) {
    return `${base} ${params.sinceDate}`;
  }
  if (campaign.audienceRuleType === "NEVER_RECEIVED_TYPE" && params.campaignType) {
    return `${base} ${CAMPAIGN_TYPE_LABELS[params.campaignType as CampaignType] ?? params.campaignType}`;
  }
  if (campaign.audienceRuleType === "RECEIVED_TYPE_BEFORE_DATE" && params.campaignType) {
    const typeLabel = CAMPAIGN_TYPE_LABELS[params.campaignType as CampaignType] ?? params.campaignType;
    return `${base} ${typeLabel} (${params.beforeDate})`;
  }
  return base;
}

export function useCustomerTypeNames(): Record<string, string> {
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});
  useEffect(() => {
    listCustomerTypes()
      .then((types) => setTypeNames(Object.fromEntries(types.map((t) => [t.id, t.name]))))
      .catch(() => {
        // Non-fatal — CUSTOMER_TYPE rows just fall back to the generic label.
      });
  }, []);
  return typeNames;
}

export function formatCampaignDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });
}

export function campaignDateCell(campaign: SmsCampaign) {
  if (campaign.scheduledAt) {
    return { label: "Scheduled", value: formatCampaignDateTime(campaign.scheduledAt) };
  }
  return { label: "Created", value: formatCampaignDateTime(campaign.createdAt) };
}

const CSV_HEADERS = [
  "Campaign",
  "Channel",
  "Type",
  "Audience",
  "Recipients",
  "SMS Segments",
  "Status",
  "Sender ID",
  "Subject",
  "Date",
  "Cost",
];

function campaignToCsvRow(
  campaign: SmsCampaign,
  typeNames: Record<string, string>
): (string | number)[] {
  const date = campaignDateCell(campaign);
  return [
    campaign.name,
    campaign.channel === "EMAIL" ? "Email" : "SMS",
    CAMPAIGN_TYPE_LABELS[campaign.campaignType],
    describeAudience(campaign, typeNames),
    campaign.recipientsResolvedAt ? campaign.totalRecipients : "Resolving",
    campaign.channel === "EMAIL" ? "" : campaign.smsSegments,
    campaign.status,
    campaign.senderId ?? "",
    campaign.subject ?? "",
    `${date.label}: ${date.value}`,
    campaign.estimatedCost,
  ];
}

/** Downloads `campaigns` (optionally filtered to one channel) as CSV,
 * built client-side since the data driving both export entry points is
 * already loaded. */
export function exportCampaignsCsv(
  campaigns: SmsCampaign[],
  channel: CampaignChannel | "all",
  typeNames: Record<string, string>
) {
  const filtered = channel === "all" ? campaigns : campaigns.filter((c) => c.channel === channel);
  const csv = buildCsv(CSV_HEADERS, filtered.map((campaign) => campaignToCsvRow(campaign, typeNames)));
  const suffix = channel === "all" ? "all" : channel.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`campaigns-${suffix}-${today}.csv`, csv);
}
