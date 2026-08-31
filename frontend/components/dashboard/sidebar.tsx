import { Brand } from "@/components/dashboard/brand";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Separator } from "@/components/ui/separator";
import { getResolvedLogoUrlSafe } from "@/lib/api/site-settings";

export async function Sidebar() {
  const logoUrl = await getResolvedLogoUrlSafe();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar shadow-[1px_0_0_0_rgba(0,0,0,0.02)] md:flex md:flex-col h-screen overflow-hidden">
      <div className="flex h-16 shrink-0 items-center px-4">
        <Brand logoUrl={logoUrl} />
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DashboardNav />
      </div>
    </aside>
  );
}
