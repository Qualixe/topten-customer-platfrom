import { Mail, MessageCircle, MessageSquare, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NotificationChannel } from "@/lib/api/notifications";

const CHANNEL_ICONS: Record<NotificationChannel, LucideIcon> = {
  SMS: MessageSquare,
  Email: Mail,
  WhatsApp: MessageCircle,
};

const CHANNEL_STYLES: Record<NotificationChannel, string> = {
  SMS: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400",
  Email:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400",
  WhatsApp:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
};

export function ChannelBadge({ channel }: { channel: NotificationChannel }) {
  const Icon = CHANNEL_ICONS[channel];

  return (
    <Badge className={cn(CHANNEL_STYLES[channel])}>
      <Icon className="size-3" aria-hidden="true" />
      {channel}
    </Badge>
  );
}
