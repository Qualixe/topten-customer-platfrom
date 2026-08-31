"use client";

import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

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
        {day.count} new customer{day.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function SignupsChart({ data, total }: { data: DayCount[]; total: number }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>New Customers</CardTitle>
        <CardDescription>Last {data.length} days</CardDescription>
        <CardAction>
          <Link href="/dashboard/customers" className="text-sm font-medium text-primary hover:underline">
            View Report
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="mb-4 text-2xl font-semibold tracking-tight tabular-nums">
          {total.toLocaleString("en-US")}
        </p>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="30%">
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="count" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
