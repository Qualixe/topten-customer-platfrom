"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSharePercent } from "@/lib/format-share";

const SEGMENT_COLORS = {
  General: "#fca5a5",
  VIP: "#ef4444",
  VVIP: "#7f1d1d",
} as const;

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

export function CustomerMixDonut({
  general,
  vip,
  vvip,
}: {
  general: number;
  vip: number;
  vvip: number;
}) {
  const total = general + vip + vvip;
  const data = [
    { name: "General", value: general },
    { name: "VIP", value: vip },
    { name: "VVIP", value: vvip },
  ];

  return (
    <Card>
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
                {data.map((entry) => (
                  <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name as keyof typeof SEGMENT_COLORS]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-semibold">{total.toLocaleString("en-US")}</p>
            <p className="text-xs text-muted-foreground">customers</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {data.map((entry) => {
            return (
              <div key={entry.name} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SEGMENT_COLORS[entry.name as keyof typeof SEGMENT_COLORS] }}
                  aria-hidden="true"
                />
                <span className="flex-1 text-muted-foreground">{entry.name}</span>
                <span className="font-medium">{formatSharePercent(entry.value, total)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
