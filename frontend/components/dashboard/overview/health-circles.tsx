import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSharePercent } from "@/lib/format-share";
import { cn } from "@/lib/utils";

interface RateCircle {
  label: string;
  display: string;
  size: number;
  className: string;
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
      className: "bg-red-500/90 text-white",
      position: "right-0 top-1/2 -translate-y-1/2",
    },
    {
      label: "Verified",
      display: formatSharePercent(verifiedCustomers, totalCustomers),
      size: 128,
      className: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100",
      position: "left-2 top-0",
    },
    {
      label: "VIP",
      display: formatSharePercent(vipCustomers, totalCustomers),
      size: 116,
      className: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-50",
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
                "absolute flex flex-col items-center justify-center rounded-full shadow-sm",
                circle.position,
                circle.className
              )}
              style={{ width: circle.size, height: circle.size }}
            >
              <span className="text-2xl font-semibold">{circle.display}</span>
              <span className="text-xs opacity-90">{circle.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
