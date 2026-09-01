import Link from "next/link";
import { Bell } from "lucide-react";

import { ApiConnectionIndicator } from "@/components/dashboard/api-connection-indicator";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PageTitle } from "@/components/dashboard/page-title";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/api/auth";
import { getResolvedLogoUrlSafe } from "@/lib/api/site-settings";

export async function Header({ user }: { user: AuthUser | null }) {
  const logoUrl = await getResolvedLogoUrlSafe();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <MobileNav logoUrl={logoUrl} />
      <PageTitle />
      <div className="ml-auto flex items-center gap-1.5">
        <ApiConnectionIndicator />
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground transition-colors hover:text-foreground"
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
