import { ImportsPageHeader } from "@/components/dashboard/imports/page-header";
import { ImportsWorkspace } from "@/components/dashboard/imports/imports-workspace";
import { listImportBatches } from "@/lib/api/imports";

// Real, frequently-changing backend data — must not be statically cached.
export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const { items } = await listImportBatches(20);

  return (
    <div className="flex flex-col gap-6">
      <ImportsPageHeader />
      <ImportsWorkspace initialHistory={items} />
    </div>
  );
}
