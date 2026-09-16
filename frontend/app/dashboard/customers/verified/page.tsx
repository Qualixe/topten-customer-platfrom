import { ShieldCheck } from "lucide-react";

import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { VerifiedCustomersCampaignFilter } from "@/components/dashboard/customers-verified/verified-customers-campaign-filter";
import { VerifiedCustomersExportButton } from "@/components/dashboard/customers-verified/verified-customers-export-button";
import { VerifiedCustomersPagination } from "@/components/dashboard/customers-verified/verified-customers-pagination";
import { VerifiedCustomersTable } from "@/components/dashboard/customers-verified/verified-customers-table";
import { VerifiedCustomersToolbar } from "@/components/dashboard/customers-verified/verified-customers-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUserSafeCached } from "@/lib/api/auth";
import { listCampaigns } from "@/lib/api/campaigns";
import { listVerifiedCustomers, type CustomerStatus } from "@/lib/api/customers";
import { settleOk } from "@/lib/api/settle";
import { SPEND_RANGES } from "@/lib/spend-ranges";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifiedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // searchParams isn't a network call — resolved first since the
  // customers fetch below needs it to build its query, before it can be
  // fired alongside the (real, network) permission check instead of after.
  const raw = await searchParams;
  const page = Number(firstValue(raw.page)) || 1;
  const search = firstValue(raw.search) ?? "";
  const campaignId = firstValue(raw.campaignId);
  const customerTypeId = firstValue(raw.customerTypeId) ?? "all";
  const status = (firstValue(raw.status) as CustomerStatus | undefined) ?? "all";
  const city = firstValue(raw.city) ?? "all";
  const spendRange = SPEND_RANGES.find((range) => range.key === firstValue(raw.spendRange));

  const [user, customersResult, campaignsResult] = await Promise.all([
    getCurrentUserSafeCached(),
    settleOk(
      listVerifiedCustomers({
        page,
        search,
        campaignId,
        customerTypeId,
        status,
        city,
        minTotalSpent: spendRange?.min,
        maxTotalSpent: spendRange?.max,
      })
    ),
    settleOk(listCampaigns({ pageSize: 100 })),
  ]);
  if (!user?.permissions.includes("customers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <PermissionDenied description="Ask an admin to grant you the View customers permission if you think this is a mistake." />
      </div>
    );
  }

  // Guaranteed defined here — the backend enforces the same permission
  // just checked above, so an authorized user's fetches cannot have failed.
  const { items, total, pageSize, page: currentPage } = customersResult!;
  const { items: campaigns } = campaignsResult!;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Verified Customers</h2>
        <p className="text-sm text-muted-foreground">
          Customers who completed at least one campaign profile form, the standalone Forms
          feature, or were manually verified by an admin. A customer verified through multiple
          campaigns appears once per campaign.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <VerifiedCustomersToolbar />
            </div>
            <VerifiedCustomersCampaignFilter
              campaigns={campaigns.map((campaign) => ({
                id: campaign.id,
                name: campaign.name,
                date: campaign.scheduledAt ?? campaign.createdAt,
              }))}
            />
            <VerifiedCustomersExportButton />
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No verified customers found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <VerifiedCustomersTable items={items} />
          )}

          <VerifiedCustomersPagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
