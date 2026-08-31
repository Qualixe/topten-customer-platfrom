import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSharePercent } from "@/lib/format-share";
import { cn } from "@/lib/utils";

interface RateCircle {
  label: string;
  display: string;
  size: number;
  /** Derived from the one admin-editable brand color via color-mix, so
   * this stays on-brand automatically instead of hardcoding a fixed red
   * family. */
  background: string;
  textClassName: string;
  position: string;
}

export function HealthCircles({
  totalCustomers,
  profileCompleteCustomers,
  verifiedCustomers,
  vipCustomers,
}: {
  totalCustomers: number;
  profileCompleteCustomers: number;
  verifiedCustomers: number;
  vipCustomers: number;
}) {
  const circles: RateCircle[] = [
    {
      label: "Profile Complete",
      display: formatSharePercent(profileCompleteCustomers, totalCustomers),
      size: 168,
      background: "var(--primary)",
      textClassName: "text-primary-foreground",
      position: "right-0 top-1/2 -translate-y-1/2",
    },
    {
      label: "Verified",
      display: formatSharePercent(verifiedCustomers, totalCustomers),
      size: 128,
      background: "color-mix(in oklch, var(--primary) 22%, var(--card))",
      textClassName: "text-foreground",
      position: "left-2 top-0",
    },
    {
      label: "VIP",
      display: formatSharePercent(vipCustomers, totalCustomers),
      size: 116,
      background: "color-mix(in oklch, var(--primary) 12%, var(--card))",
      textClassName: "text-foreground",
      position: "left-0 bottom-0",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Health</CardTitle>
        <CardDescription>Share of your customer base, by data quality</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto h-56 w-full max-w-72">
          {circles.map((circle) => (
            <div
              key={circle.label}
              className={cn(
                "absolute flex flex-col items-center justify-center rounded-full shadow-sm ring-1 ring-foreground/5",
                circle.position,
                circle.textClassName
              )}
              style={{ width: circle.size, height: circle.size, background: circle.background }}
            >
              <span className="text-2xl font-semibold tabular-nums">{circle.display}</span>
              <span className="text-xs opacity-90">{circle.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
