import { AlertTriangle, Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, type SmsAccountWithStatus } from "@/lib/api/sms-account";

export function SmsBalanceCard({ account }: { account: SmsAccountWithStatus }) {
  const isLow = !account.balanceError && account.balanceCredits <= account.lowBalanceThreshold;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
          SMS Balance
        </CardTitle>
        <CardDescription>Available credit for sending campaigns</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {account.balanceError ? (
            <p className="text-2xl font-semibold text-muted-foreground">—</p>
          ) : (
            <p className="text-2xl font-semibold">
              {formatCurrency(account.balanceCredits)}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(account.ratePerSegmentBdt)} per SMS segment
          </p>
        </div>
        {account.balanceError ? (
          <p
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              "border-destructive/30 bg-destructive/10 text-destructive"
            )}
            title={account.balanceError}
          >
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-xs truncate">{account.balanceError}</span>
          </p>
        ) : (
          isLow && (
            <p
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
              )}
            >
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Balance is low — top up soon
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
