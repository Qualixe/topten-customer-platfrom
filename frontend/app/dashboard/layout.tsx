import { Header } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { getCurrentUserSafeCached } from "@/lib/api/auth";

// Every dashboard page reads the caller's auth cookie (directly or via a
// nested fetch) to talk to the backend — there's no valid session at build
// time, so none of this subtree can be statically prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardLayout(props: LayoutProps<"/dashboard">) {
  const user = await getCurrentUserSafeCached();

  return (
    <PermissionsProvider user={user}>
      <div className="flex h-screen overflow-hidden bg-muted/30">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header user={user} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{props.children}</main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
