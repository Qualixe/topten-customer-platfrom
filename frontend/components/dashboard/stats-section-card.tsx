import { StatsGrid, type StatDefinition } from "@/components/dashboard/stats-grid";

/** A titled group of stat tiles — just a heading above `StatsGrid`, so a
 * grouped section (e.g. "Customers", "Birthdays") renders with exactly
 * the same individual-card tile design as every other stats row in the
 * app, rather than a second, differently-styled variant. */
export function StatsSectionCard({
  title,
  stats,
  show_title = true,
}: {
  title: string;
  stats: StatDefinition[];
  /** Set to false to render just the tiles, with no heading above them. */
  show_title?: boolean;
}) {
  const columns = stats.length as 3 | 4 | 5 | 6 | 7;

  return (
    <div className="flex flex-col gap-3">
      {show_title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <StatsGrid stats={stats} columns={columns} />
    </div>
  );
}
