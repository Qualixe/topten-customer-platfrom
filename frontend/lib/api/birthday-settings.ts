import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export interface BirthdaySettings {
  notifyDaysBefore: number;
  autoSendMessage: boolean;
  messageTemplate: string;
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
    auto_assign_gift: input.autoAssignGift,
  });
  return envelope.data;
}

export interface SendBirthdayWishesReport {
  total: number;
  sent: number;
  failed: number;
  skippedAlreadySent: number;
}

/** Runs the exact same job the daily schedule runs, on demand — see
 * app.controllers.birthday_settings.send_now. Still a no-op unless
 * autoSendMessage is on and the SMS gateway is configured. */
export async function sendBirthdayWishesNow(): Promise<SendBirthdayWishesReport> {
  const envelope = await apiPost<ApiEnvelope<SendBirthdayWishesReport>>(
    "/settings/birthday/send-now",
    {}
  );
  return envelope.data;
}
