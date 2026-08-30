import {
  getCustomerStats,
  listCustomers,
  listPosCustomers,
  listVerifiedCustomers,
} from "@/lib/api/customers";
import { listGiftCatalog, listGiftOrders, type GiftItem } from "@/lib/api/gifts";
import { listNotifications } from "@/lib/api/notifications";

const TREND_DAYS = 14;
const TOP_GIFTS_LIMIT = 4;

export interface DayCount {
  /** "YYYY-MM-DD", the store's own calendar day (Asia/Dhaka). */
  date: string;
  /** Short label for chart axes, e.g. "Aug 24". */
  label: string;
  count: number;
}

export interface DashboardOverview {
  signupsByDay: DayCount[];
  giftOrdersByDay: DayCount[];
  totalSignups: number;
  totalGiftOrders: number;
  customerMix: { general: number; vip: number; vvip: number };
  totalCustomers: number;
  verifiedCustomers: number;
  profileCompleteCustomers: number;
  vipCustomers: number;
  topGifts: GiftItem[];
  today: {
    /** Campaign/birthday/VIP-reward SMS sent today (excludes gift SMS). */
    campaignSends: number;
    /** Customers who completed a campaign's profile form today — also
     * what "form submitted" means, since open (tokenless) form
     * submissions don't keep a separate per-submission log to count. */
    formsReceived: number;
    /** Gift orders actually sent (their SMS notification attempted, real
     * or failed) today. */
    giftsDelivered: number;
  };
}

/** Asia/Dhaka is UTC+6 year-round (no DST) — shifting by that fixed offset
 * before reading the UTC date back out gives the store's own calendar day
 * without needing `Intl` timezone plumbing. */
function dhakaDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function lastNDhakaDays(n: number): string[] {
  const todayKey = dhakaDateKey(new Date());
  const [year, month, day] = todayKey.split("-").map(Number);
  const todayUtcMidnight = Date.UTC(year, month - 1, day);

  return Array.from({ length: n }, (_, index) => {
    const offset = (n - 1 - index) * 24 * 60 * 60 * 1000;
    return new Date(todayUtcMidnight - offset).toISOString().slice(0, 10);
  });
}

function labelFor(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Everything the redesigned dashboard's charts need, built entirely from
 * existing endpoints (no new backend routes) — day-by-day counts are
 * fetched as parallel single-day `created_from`/`created_to` queries
 * against the same `/customers` list the POS Customers page already uses,
 * and gift-order/gift-catalog trends are bucketed here from the existing
 * list endpoints rather than pre-aggregated server-side.
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const days = lastNDhakaDays(TREND_DAYS);
  const today = days[days.length - 1];

  const [
    stats,
    verifiedResult,
    generalResult,
    vipResult,
    vvipResult,
    profileCompleteResult,
    signupCounts,
    giftOrdersResult,
    giftCatalogResult,
    todayVerifiedResult,
    todaySentNotifications,
    todaySentGiftOrders,
  ] = await Promise.all([
    getCustomerStats(),
    listCustomers({ verified: true, pageSize: 1 }),
    listPosCustomers({ customerType: "GENERAL", pageSize: 1 }),
    listPosCustomers({ customerType: "VIP", pageSize: 1 }),
    listPosCustomers({ customerType: "VVIP", pageSize: 1 }),
    listPosCustomers({ profileStatus: "COMPLETE", pageSize: 1 }),
    Promise.all(
      days.map((day) =>
        listPosCustomers({ createdFrom: day, createdTo: day, pageSize: 1 }).then(
          (result) => result.total
        )
      )
    ),
    listGiftOrders({ pageSize: 100 }),
    listGiftCatalog({ pageSize: 100 }),
    listVerifiedCustomers({ verifiedFrom: today, verifiedTo: today, pageSize: 1 }),
    listNotifications({ pageSize: 200 }),
    listGiftOrders({ status: "SENT", pageSize: 100 }),
  ]);

  const signupsByDay: DayCount[] = days.map((date, index) => ({
    date,
    label: labelFor(date),
    count: signupCounts[index],
  }));

  const giftOrderCountByDay = new Map<string, number>(days.map((date) => [date, 0]));
  for (const order of giftOrdersResult.items) {
    const key = dhakaDateKey(new Date(order.createdAt));
    if (giftOrderCountByDay.has(key)) {
      giftOrderCountByDay.set(key, (giftOrderCountByDay.get(key) ?? 0) + 1);
    }
  }
  const giftOrdersByDay: DayCount[] = days.map((date) => ({
    date,
    label: labelFor(date),
    count: giftOrderCountByDay.get(date) ?? 0,
  }));

  const topGifts = [...giftCatalogResult.items]
    .sort((a, b) => b.timesRedeemed - a.timesRedeemed)
    .slice(0, TOP_GIFTS_LIMIT);

  const todayCampaignSends = todaySentNotifications.items.filter(
    (notification) =>
      notification.type !== "Gift Notification" &&
      notification.status !== "Pending" &&
      notification.sentAt !== null &&
      dhakaDateKey(new Date(notification.sentAt)) === today
  ).length;

  const todayGiftsDelivered = todaySentGiftOrders.items.filter(
    (order) => order.sentAt !== null && dhakaDateKey(new Date(order.sentAt)) === today
  ).length;

  return {
    signupsByDay,
    giftOrdersByDay,
    totalSignups: signupsByDay.reduce((sum, day) => sum + day.count, 0),
    totalGiftOrders: giftOrdersByDay.reduce((sum, day) => sum + day.count, 0),
    customerMix: {
      general: generalResult.total,
      vip: vipResult.total,
      vvip: vvipResult.total,
    },
    totalCustomers: stats.totalCustomers,
    verifiedCustomers: verifiedResult.total,
    profileCompleteCustomers: profileCompleteResult.total,
    vipCustomers: stats.vipCustomers,
    topGifts,
    today: {
      campaignSends: todayCampaignSends,
      formsReceived: todayVerifiedResult.total,
      giftsDelivered: todayGiftsDelivered,
    },
  };
}
