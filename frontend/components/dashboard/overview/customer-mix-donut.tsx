"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerMixSegment } from "@/lib/api/dashboard-overview";
import { formatSharePercent } from "@/lib/format-share";

/** Every tone derives from the one admin-editable brand color (Settings →
 * General) via color-mix, so this stays on-brand automatically instead of
 * hardcoding a fixed color family — and works for however many customer
 * types (segments) an account actually has, not just three. */
function colorForSegment(index: number, count: number): string {
  if (count <= 1) return "var(--primary)";
  const mixPercent = 30 + (index * 55) / (count - 1);
  return `color-mix(in oklch, var(--primary) ${mixPercent}%, var(--card))`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  const segment = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{segment.name}</p>
      <p className="text-muted-foreground">{segment.value.toLocaleString("en-US")} customers</p>
    </div>
  );
}

export function CustomerMixDonut({ segments }: { segments: CustomerMixSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const data = segments.map((segment) => ({ name: segment.name, value: segment.count }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Customer Mix</CardTitle>
        <CardDescription>By customer type, across every customer</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="65%"
                outerRadius="100%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={colorForSegment(index, data.length)} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-semibold tabular-nums">{total.toLocaleString("en-US")}</p>
            <p className="text-xs text-muted-foreground">customers</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {data.map((entry, index) => {
            return (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForSegment(index, data.length) }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-muted-foreground">{entry.name}</span>
                <span className="font-medium tabular-nums">{formatSharePercent(entry.value, total)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
