import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatDefinition, StatTrend } from "@/components/dashboard/stats-grid";

const TREND_STYLES: Record<StatTrend, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-500 dark:text-rose-400",
  neutral: "text-muted-foreground",
};

const TREND_ICONS: Record<StatTrend, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const ICON_STYLES = [
  { bg: "bg-rose-50   dark:bg-rose-950",   text: "text-rose-500   dark:text-rose-400"   },
  { bg: "bg-amber-50  dark:bg-amber-950",  text: "text-amber-500  dark:text-amber-400"  },
  { bg: "bg-emerald-50 dark:bg-emerald-950",text:"text-emerald-600 dark:text-emerald-400"},
  { bg: "bg-sky-50    dark:bg-sky-950",    text: "text-sky-500    dark:text-sky-400"    },
  { bg: "bg-violet-50 dark:bg-violet-950", text: "text-violet-500 dark:text-violet-400" },
  { bg: "bg-pink-50   dark:bg-pink-950",   text: "text-pink-500   dark:text-pink-400"   },
  { bg: "bg-orange-50 dark:bg-orange-950", text: "text-orange-500 dark:text-orange-400" },
];

export function StatsSectionCard({
  title,
  stats,
}: {
  title: string;
  stats: StatDefinition[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* ── Section title ──────────────────────────────── */}
      <div className="border-b border-border px-5 py-2.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>

      {/* ── Stat tiles ─────────────────────────────────── */}
      <div className="grid"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend ? TREND_ICONS[stat.trend] : null;
          const { bg, text } = ICON_STYLES[index % ICON_STYLES.length];

          return (
            <div
              key={stat.key}
              className="flex items-center gap-5 px-5 py-4"
              style={{ borderRight: "1px solid #ccc" }}
            >
              {/* Icon */}
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", bg)}>
                <Icon className={cn("size-5", text)} aria-hidden="true" />
              </div>

              {/* Text */}
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none tracking-tight tabular-nums text-foreground">
                  {stat.value}
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground mt-1">
                  {stat.label}
                </p>
                {stat.trend && TrendIcon ? (
                  <p className={cn("mt-1 flex items-center gap-1 text-xs", TREND_STYLES[stat.trend])}>
                    <TrendIcon className="size-3" aria-hidden="true" />
                    {stat.caption}
                  </p>
                ) : stat.caption ? (
                  <p className="mt-1 text-xs text-muted-foreground">{stat.caption}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
