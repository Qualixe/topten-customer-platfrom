import { Brand } from "@/components/dashboard/brand";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getResolvedLogoUrlSafe } from "@/lib/api/site-settings";

export async function Sidebar() {
  const logoUrl = await getResolvedLogoUrlSafe();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar shadow-[1px_0_0_0_rgba(0,0,0,0.02)] md:flex md:flex-col">
      <div className="flex h-16 items-center px-4">
        <Brand logoUrl={logoUrl} />
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <DashboardNav />
      </ScrollArea>
    </aside>
  );
}
