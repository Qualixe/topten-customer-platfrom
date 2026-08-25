import {
  Blocks,
  Coffee,
  Cpu,
  Home,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react";

import type { GiftCategory } from "@/lib/api/gifts";

interface GiftCategoryVisual {
  icon: LucideIcon;
  tileClassName: string;
  iconClassName: string;
}

export const GIFT_CATEGORY_VISUALS: Record<GiftCategory, GiftCategoryVisual> = {
  FOOD_AND_BEVERAGE: {
    icon: Coffee,
    tileClassName: "bg-amber-50 dark:bg-amber-950/40",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  HOME_AND_LIVING: {
    icon: Home,
    tileClassName: "bg-blue-50 dark:bg-blue-950/40",
    iconClassName: "text-blue-600 dark:text-blue-400",
  },
  BEAUTY_AND_WELLNESS: {
    icon: Sparkles,
    tileClassName: "bg-rose-50 dark:bg-rose-950/40",
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
  ELECTRONICS: {
    icon: Cpu,
    tileClassName: "bg-indigo-50 dark:bg-indigo-950/40",
    iconClassName: "text-indigo-600 dark:text-indigo-400",
  },
  GIFT_VOUCHERS: {
    icon: Ticket,
    tileClassName: "bg-emerald-50 dark:bg-emerald-950/40",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  KIDS_AND_TOYS: {
    icon: Blocks,
    tileClassName: "bg-orange-50 dark:bg-orange-950/40",
    iconClassName: "text-orange-600 dark:text-orange-400",
  },
};
