import { paginate, simulateNetworkDelay } from "@/lib/api/client";
import type { PaginatedResponse, PaginationParams } from "@/lib/api/types";
import {
  deliveredNotificationsCount,
  deliveryRate,
  failedNotificationsCount,
  mockNotifications,
  totalNotifications,
  type NotificationRecord,
  type NotificationStatus,
} from "@/lib/mock/notifications";

export type {
  NotificationChannel,
  NotificationRecord,
  NotificationStatus,
  NotificationType,
} from "@/lib/mock/notifications";

export interface NotificationStats {
  total: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export interface ListNotificationsParams extends PaginationParams {
  status?: NotificationStatus;
}

/**
 * Fetches a page of notifications, optionally filtered by status.
 *
 * Backed by in-memory mock data for now — swap for `apiFetch` once
 * `/notifications` exists on the backend.
 */
export async function listNotifications(
  params: ListNotificationsParams = {}
): Promise<PaginatedResponse<NotificationRecord>> {
  await simulateNetworkDelay();
  const { status, ...pagination } = params;
  const notifications = status
    ? mockNotifications.filter((notification) => notification.status === status)
    : mockNotifications;
  return paginate(notifications, pagination);
}

export async function getNotificationStats(): Promise<NotificationStats> {
  await simulateNetworkDelay();
  return {
    total: totalNotifications,
    delivered: deliveredNotificationsCount,
    failed: failedNotificationsCount,
    deliveryRate,
  };
}
