import { apiGet, apiPut } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export type BirthdayChannel = "SMS" | "EMAIL" | "BOTH";

export interface BirthdaySettings {
  notifyDaysBefore: number;
  enabled: boolean;
  channel: BirthdayChannel;
  sendHour: number;
  sendMinute: number;
  companyName: string;
  messageTemplate: string;
  emailSubject: string;
  emailMessageTemplate: string;
  autoAssignGift: boolean;
  lastRunAt: string | null;
}

export async function getBirthdaySettings(): Promise<BirthdaySettings> {
  const envelope = await apiGet<ApiEnvelope<BirthdaySettings>>("/settings/birthday");
  return envelope.data;
}

export async function updateBirthdaySettings(
  input: Omit<BirthdaySettings, "lastRunAt">
): Promise<BirthdaySettings> {
  const envelope = await apiPut<ApiEnvelope<BirthdaySettings>>("/settings/birthday", {
    notify_days_before: input.notifyDaysBefore,
    enabled: input.enabled,
    channel: input.channel,
    send_hour: input.sendHour,
    send_minute: input.sendMinute,
    company_name: input.companyName,
    message_template: input.messageTemplate,
    email_subject: input.emailSubject,
    email_message_template: input.emailMessageTemplate,
    auto_assign_gift: input.autoAssignGift,
  });
  return envelope.data;
}
