import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTrend = "up" | "down" | "neutral";

export interface StatDefinition {
  key: string;
  label: string;
  value: string | number;
  caption?: string;
  icon: LucideIcon;
  trend?: StatTrend;
}

const TREND_STYLES: Record<StatTrend, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const TREND_ICONS: Record<StatTrend, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

/** Cycled by card position so every stats row reads as a set of distinct,
 * colorful metrics rather than identical gray tiles — the brand color leads
 * (first card), then a fixed run of complementary accents. */
const ICON_TONES = [
  "bg-primary/10 text-primary",
  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
];

const COLUMNS_CLASS: Record<3 | 4 | 5, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};

export function StatsGrid({
  stats,
  columns = 4,
}: {
  stats: StatDefinition[];
  /** Column count at the `lg` breakpoint — defaults to 4, matching every
   * page except Campaigns (5, for "Failed") and the Dashboard's smaller
   * grouped rows (3). */
  columns?: 3 | 4 | 5;
}) {
  return (
    <div className={cn("grid gap-4", COLUMNS_CLASS[columns])}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const TrendIcon = stat.trend ? TREND_ICONS[stat.trend] : null;
        const tone = ICON_TONES[index % ICON_TONES.length];

        return (
          <Card key={stat.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between font-normal text-muted-foreground">
                {stat.label}
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md",
                    tone
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stat.value}</p>
              {stat.trend && TrendIcon ? (
                <p
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs",
                    TREND_STYLES[stat.trend]
                  )}
                >
                  <TrendIcon className="size-3.5" aria-hidden="true" />
                  {stat.caption}
                </p>
              ) : stat.caption ? (
                <p className="mt-1 text-xs text-muted-foreground">{stat.caption}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
