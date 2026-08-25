import {
  Blocks,
  Coffee,
  Cpu,
  Gift,
  Home,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react";

interface GiftCategoryVisual {
  icon: LucideIcon;
  tileClassName: string;
  iconClassName: string;
}

/** Nice icon/color pairings for the categories seeded by default. Categories
 * are admin-managed now (not a fixed enum) — a custom one just falls back to
 * a generic look via `getGiftCategoryVisual` below rather than being an
 * error case. */
const KNOWN_CATEGORY_VISUALS: Record<string, GiftCategoryVisual> = {
  "Food & Beverage": {
    icon: Coffee,
    tileClassName: "bg-amber-50 dark:bg-amber-950/40",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  "Home & Living": {
    icon: Home,
    tileClassName: "bg-blue-50 dark:bg-blue-950/40",
    iconClassName: "text-blue-600 dark:text-blue-400",
  },
  "Beauty & Wellness": {
    icon: Sparkles,
    tileClassName: "bg-rose-50 dark:bg-rose-950/40",
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
  Electronics: {
    icon: Cpu,
    tileClassName: "bg-indigo-50 dark:bg-indigo-950/40",
    iconClassName: "text-indigo-600 dark:text-indigo-400",
  },
  "Gift Vouchers": {
    icon: Ticket,
    tileClassName: "bg-emerald-50 dark:bg-emerald-950/40",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  "Kids & Toys": {
    icon: Blocks,
    tileClassName: "bg-orange-50 dark:bg-orange-950/40",
    iconClassName: "text-orange-600 dark:text-orange-400",
  },
};

/** Rotating palette for any category name outside the known list above,
 * picked deterministically per name so the same category always looks the
 * same rather than flickering between renders. */
const FALLBACK_PALETTE: Omit<GiftCategoryVisual, "icon">[] = [
  { tileClassName: "bg-teal-50 dark:bg-teal-950/40", iconClassName: "text-teal-600 dark:text-teal-400" },
  { tileClassName: "bg-violet-50 dark:bg-violet-950/40", iconClassName: "text-violet-600 dark:text-violet-400" },
  { tileClassName: "bg-cyan-50 dark:bg-cyan-950/40", iconClassName: "text-cyan-600 dark:text-cyan-400" },
  { tileClassName: "bg-fuchsia-50 dark:bg-fuchsia-950/40", iconClassName: "text-fuchsia-600 dark:text-fuchsia-400" },
  { tileClassName: "bg-lime-50 dark:bg-lime-950/40", iconClassName: "text-lime-600 dark:text-lime-400" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getGiftCategoryVisual(categoryName: string): GiftCategoryVisual {
  const known = KNOWN_CATEGORY_VISUALS[categoryName];
  if (known) return known;

  const palette = FALLBACK_PALETTE[hashString(categoryName) % FALLBACK_PALETTE.length];
  return { icon: Gift, ...palette };
}
