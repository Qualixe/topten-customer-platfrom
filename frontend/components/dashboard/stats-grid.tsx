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

const COLUMNS_CLASS: Record<4 | 5, string> = {
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};

export function StatsGrid({
  stats,
  columns = 4,
}: {
  stats: StatDefinition[];
  /** Column count at the `lg` breakpoint — defaults to 4, matching every
   * page except Campaigns, which has a 5th ("Failed") stat. */
  columns?: 4 | 5;
}) {
  return (
    <div className={cn("grid gap-4", COLUMNS_CLASS[columns])}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        const TrendIcon = stat.trend ? TREND_ICONS[stat.trend] : null;

        return (
          <Card key={stat.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between font-normal text-muted-foreground">
                {stat.label}
                <span className="flex size-8 items-center justify-center rounded-md bg-muted">
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
