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
  sentAt: string;
  deliveredAt: string | null;
  failureReason: string | null;
}

const RECIPIENTS: { name: string; email: string; phone: string }[] = [
  { name: "Farhana Akter", email: "farhana.akter@example.com", phone: "+8801711000101" },
  { name: "Rakib Hossain", email: "rakib.hossain@example.com", phone: "+8801711000102" },
  { name: "Ayesha Sultana", email: "ayesha.sultana@example.com", phone: "+8801711000103" },
  { name: "Tanvir Ahmed", email: "tanvir.ahmed@example.com", phone: "+8801711000104" },
  { name: "Nadia Islam", email: "nadia.islam@example.com", phone: "+8801711000105" },
  { name: "Kamrul Haque", email: "kamrul.haque@example.com", phone: "+8801711000106" },
  { name: "Israt Jahan", email: "israt.jahan@example.com", phone: "+8801711000107" },
  { name: "Shafin Karim", email: "shafin.karim@example.com", phone: "+8801711000108" },
  { name: "Promi Das", email: "promi.das@example.com", phone: "+8801711000109" },
  { name: "Zayan Chowdhury", email: "zayan.chowdhury@example.com", phone: "+8801711000110" },
  { name: "Amelia Chowdhury", email: "amelia.chowdhury@example.com", phone: "+8801711000111" },
  { name: "Rafiq Islam", email: "rafiq.islam@example.com", phone: "+8801711000112" },
];

const MESSAGE_TEMPLATES: {
  type: NotificationType;
  subject: string;
  message: string;
}[] = [
  {
    type: "Birthday Wish",
    subject: "Happy Birthday from TopTen!",
    message: "Wishing you a wonderful birthday! Enjoy a special gift on us this week.",
  },
  {
    type: "Gift Notification",
    subject: "Your gift is on the way",
    message: "Great news — your redeemed gift has been dispatched and is on its way to you.",
  },
  {
    type: "Campaign",
    subject: "Eid Collection is here",
    message: "Explore our new Eid Collection with exclusive discounts for loyal customers.",
  },
  {
    type: "Order Update",
    subject: "Your order has shipped",
    message: "Your recent order has been shipped and should arrive within 2-3 business days.",
  },
  {
    type: "VIP Reward",
    subject: "You've earned a VIP reward",
    message: "Congratulations! You've reached a new VIP milestone and unlocked a reward.",
  },
];

const CHANNEL_CYCLE: NotificationChannel[] = ["SMS", "Email", "WhatsApp"];
const STATUS_CYCLE: NotificationStatus[] = [
  "Delivered", "Delivered", "Sent", "Delivered", "Failed", "Pending", "Delivered",
];

const SENT_LABELS = [
  "Just now", "10 minutes ago", "1 hour ago", "3 hours ago", "Yesterday",
  "2 days ago", "4 days ago", "1 week ago",
];

const FAILURE_REASONS: Partial<Record<NotificationChannel, string[]>> = {
  SMS: ["Invalid phone number", "Carrier rejected message", "Message delivery timed out"],
  Email: ["Mailbox does not exist", "Message marked as spam", "Recipient inbox full"],
  WhatsApp: ["Recipient has not opted in", "Number not registered on WhatsApp"],
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function buildNotifications(count: number): NotificationRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const recipient = RECIPIENTS[i % RECIPIENTS.length];
    const channel = CHANNEL_CYCLE[i % CHANNEL_CYCLE.length];
    const template = MESSAGE_TEMPLATES[(i * 2 + 1) % MESSAGE_TEMPLATES.length];
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const isDelivered = status === "Delivered";
    const isFailed = status === "Failed";
    const reasons = FAILURE_REASONS[channel] ?? ["Delivery failed"];

    return {
      id: `notif-${i + 1}`,
      channel,
      type: template.type,
      recipientName: recipient.name,
      recipientInitials: initialsFor(recipient.name),
      recipientContact: channel === "Email" ? recipient.email : recipient.phone,
      subject: template.subject,
      message: template.message,
      status,
      sentAt: SENT_LABELS[i % SENT_LABELS.length],
      deliveredAt: isDelivered ? SENT_LABELS[(i + 1) % SENT_LABELS.length] : null,
      failureReason: isFailed ? reasons[i % reasons.length] : null,
    };
  });
}

export const mockNotifications: NotificationRecord[] = buildNotifications(42);

export const failedNotifications = mockNotifications.filter(
  (notification) => notification.status === "Failed"
);

export const totalNotifications = mockNotifications.length;

export const deliveredNotificationsCount = mockNotifications.filter(
  (n) => n.status === "Delivered"
).length;

export const failedNotificationsCount = failedNotifications.length;

export const deliveryRate = Math.round(
  (deliveredNotificationsCount / Math.max(1, totalNotifications)) * 100
);

export const CHANNEL_COUNTS: Record<NotificationChannel, number> = {
  SMS: mockNotifications.filter((n) => n.channel === "SMS").length,
  Email: mockNotifications.filter((n) => n.channel === "Email").length,
  WhatsApp: mockNotifications.filter((n) => n.channel === "WhatsApp").length,
};
