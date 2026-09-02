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

const COLUMNS_CLASS: Record<3 | 4 | 5 | 6 | 7, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  7: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7",
};

export function StatsGrid({
  stats,
  columns = 4,
  compact = false,
}: {
  stats: StatDefinition[];
  /** Column count at the `lg` breakpoint — defaults to 4. Use 7 for a
   * combined dashboard row where all cards must fit on one line. */
  columns?: 3 | 4 | 5 | 6 | 7;
  /** When true, renders smaller cards (less padding, smaller text) so more
   * cards fit in a single viewport row. */
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-3", COLUMNS_CLASS[columns])}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        const TrendIcon = stat.trend ? TREND_ICONS[stat.trend] : null;

        return (
          <Card
            key={stat.key}
            size={compact ? "sm" : "default"}
            className="gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardHeader>
              <CardTitle
                className={cn(
                  "flex items-center justify-between font-medium text-muted-foreground uppercase",
                  compact ? "text-[0.65rem] tracking-wide" : "text-xs tracking-wider"
                )}
              >
                <span className="truncate pr-1">{stat.label}</span>
                <Icon
                  className={cn("shrink-0 text-muted-foreground", compact ? "size-3.5" : "size-4")}
                  aria-hidden="true"
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "font-extrabold tracking-tight tabular-nums",
                  compact ? "text-2xl" : "text-4xl"
                )}
              >
                {stat.value}
              </p>
              {stat.trend && TrendIcon ? (
                <p
                  className={cn(
                    "mt-0.5 flex items-center gap-1 text-xs",
                    TREND_STYLES[stat.trend]
                  )}
                >
                  <TrendIcon className="size-3.5" aria-hidden="true" />
                  {stat.caption}
                </p>
              ) : stat.caption ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.caption}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
