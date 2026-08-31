"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DayCount } from "@/lib/api/dashboard-overview";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DayCount }[];
}) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{day.label}</p>
      <p className="text-muted-foreground">
        {day.count} gift order{day.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function GiftOrdersChart({ data, total }: { data: DayCount[]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gift Orders</CardTitle>
        <CardDescription>Last {data.length} days</CardDescription>
        <CardAction>
          <Link href="/dashboard/gifts" className="text-sm font-medium text-primary hover:underline">
            View Report
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-2xl font-semibold tracking-tight tabular-nums">
          {total.toLocaleString("en-US")}
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="giftOrdersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#giftOrdersFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
