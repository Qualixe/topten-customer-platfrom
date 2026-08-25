import { ShieldAlert } from "lucide-react";

/**
 * Shown instead of a page's real content when the current user is logged
 * in but their role lacks the permission it needs — e.g. a Staff account
 * following a direct link to /dashboard/imports. Plain server-renderable
 * markup (no hooks) so any Server Component page can use it in place of
 * its usual `await`-ed content without becoming a Client Component.
 */
export function PermissionDenied({
  title = "You don't have access to this page",
  description = "Ask an admin to grant you the right permission if you think this is a mistake.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
