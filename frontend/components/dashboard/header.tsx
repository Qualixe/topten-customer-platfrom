import Link from "next/link";
import { Bell } from "lucide-react";

import { ApiConnectionIndicator } from "@/components/dashboard/api-connection-indicator";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PageTitle } from "@/components/dashboard/page-title";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Button } from "@/components/ui/button";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { getResolvedLogoUrlSafe } from "@/lib/api/site-settings";

export async function Header() {
  const [logoUrl, user] = await Promise.all([getResolvedLogoUrlSafe(), getCurrentUserSafe()]);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
      <MobileNav logoUrl={logoUrl} />
      <PageTitle />
      <div className="ml-auto flex items-center gap-2">
        <ApiConnectionIndicator />
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="View notifications"
          nativeButton={false}
          render={<Link href="/dashboard/notifications" />}
        >
          <Bell className="size-5" aria-hidden="true" />
        </Button>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
