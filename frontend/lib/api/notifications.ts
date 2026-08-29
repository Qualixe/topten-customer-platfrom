import { apiGet, buildQueryString } from "@/lib/api/client";
import type { ApiEnvelope, ApiListEnvelope, PaginatedResponse } from "@/lib/api/types";

export type NotificationChannel = "SMS" | "Email" | "WhatsApp";
export type NotificationStatus = "Delivered" | "Sent" | "Failed" | "Pending";
export type NotificationType =
  | "Birthday Wish"
  | "Gift Notification"
  | "Campaign"
  | "Order Update"
  | "VIP Reward";

export interface NotificationRecord {
  id: string;
  channel: NotificationChannel;
  type: NotificationType;
  recipientName: string;
  recipientInitials: string;
  recipientContact: string;
  subject: string;
  message: string;
  status: NotificationStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
}

interface NotificationDto {
  id: string;
  channel: NotificationChannel;
  type: NotificationType;
  recipientName: string;
  recipientContact: string;
  subject: string;
  message: string;
  status: NotificationStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  failureReason: string | null;
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mapDtoToRecord(dto: NotificationDto): NotificationRecord {
  return { ...dto, recipientInitials: initialsFor(dto.recipientName) };
}

export interface NotificationStats {
  total: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export interface ListNotificationsParams {
  page?: number;
  pageSize?: number;
  status?: NotificationStatus;
  type?: NotificationType;
  search?: string;
}

const DEFAULT_PAGE_SIZE = 100;

/**
 * Fetches a page of notifications from `GET /api/v1/notifications` — a real
 * log fanned in from actual SMS sends (campaign recipients + sent gift
 * orders, see backend/app/services/notification_log.py). There is no
 * Email/WhatsApp sending anywhere in this app, so those channels — and the
 * "Order Update" type, which has no backing feature — will always come
 * back with zero records rather than fabricated ones.
 */
export async function listNotifications(
  params: ListNotificationsParams = {}
): Promise<PaginatedResponse<NotificationRecord>> {
  const query = buildQueryString({
    page: params.page ?? 1,
    page_size: params.pageSize ?? DEFAULT_PAGE_SIZE,
    status: params.status,
    type: params.type,
    search: params.search?.trim() || undefined,
  });

  const envelope = await apiGet<ApiListEnvelope<NotificationDto>>(`/notifications${query}`);
  return {
    items: envelope.data.map(mapDtoToRecord),
    total: envelope.meta.total,
    page: envelope.meta.page,
    pageSize: envelope.meta.pageSize,
  };
}

export async function getNotificationStats(): Promise<NotificationStats> {
  const envelope = await apiGet<ApiEnvelope<NotificationStats>>("/notifications/stats");
  return envelope.data;
}

/** `sentAt`/`deliveredAt` are real ISO timestamps (or null, e.g. a still-
 * PENDING campaign recipient) — this renders them consistently across the
 * table, details dialog, and failed-notifications list. */
export function formatNotificationDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });
}
