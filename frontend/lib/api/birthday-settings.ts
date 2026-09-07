import { apiGet, apiPut } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export interface BirthdaySettings {
  notifyDaysBefore: number;
  autoSendMessage: boolean;
  messageTemplate: string;
  autoSendEmail: boolean;
  emailSubject: string;
  emailMessageTemplate: string;
  autoAssignGift: boolean;
}

export async function getBirthdaySettings(): Promise<BirthdaySettings> {
  const envelope = await apiGet<ApiEnvelope<BirthdaySettings>>("/settings/birthday");
  return envelope.data;
}

export async function updateBirthdaySettings(input: BirthdaySettings): Promise<BirthdaySettings> {
  const envelope = await apiPut<ApiEnvelope<BirthdaySettings>>("/settings/birthday", {
    notify_days_before: input.notifyDaysBefore,
    auto_send_message: input.autoSendMessage,
    message_template: input.messageTemplate,
    auto_send_email: input.autoSendEmail,
    email_subject: input.emailSubject,
    email_message_template: input.emailMessageTemplate,
    auto_assign_gift: input.autoAssignGift,
  });
  return envelope.data;
}
