import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MailchimpCredentials } from "@/lib/api/mailchimp";

/** `credentials` is null when the fetch failed — either the viewer lacks
 * `marketing.manage` (the credentials endpoint's own gate) or a transient
 * API error. Either way this must degrade to a generic "can't confirm
 * status" card rather than break the Campaigns page, which every
 * campaigns.view user reaches regardless of their marketing permissions. */
export function MailchimpStatusCard({ credentials }: { credentials: MailchimpCredentials | null }) {
  const configured = credentials !== null && credentials.apiKey.isSet && !!credentials.listId.value;
  const connected = configured && credentials.listValid;
  const sendReady = connected && !!credentials.fromName.value && !!credentials.replyToEmail.value;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          Mailchimp Status
        </CardTitle>
        <CardDescription>Email campaign delivery provider</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-2xl font-semibold">
            {connected ? "Connected" : configured ? "Check credentials" : "Not connected"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {connected && credentials?.listName
              ? `Audience: ${credentials.listName}`
              : "Configure in Settings to send email campaigns"}
          </p>
        </div>
        {sendReady ? (
          <p
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
            )}
          >
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Ready to send
          </p>
        ) : (
          <p
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
            )}
          >
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {configured ? "Missing sender details" : "Setup required"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
