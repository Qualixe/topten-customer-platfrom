import { ShieldCheck } from "lucide-react";

import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { VerifiedCustomersCampaignFilter } from "@/components/dashboard/customers-verified/verified-customers-campaign-filter";
import { VerifiedCustomersPagination } from "@/components/dashboard/customers-verified/verified-customers-pagination";
import { VerifiedCustomersToolbar } from "@/components/dashboard/customers-verified/verified-customers-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUserSafe } from "@/lib/api/auth";
import { listCampaigns } from "@/lib/api/campaigns";
import { listVerifiedCustomers } from "@/lib/api/customers";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifiedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getCurrentUserSafe();
  if (!user?.permissions.includes("customers.view")) {
    return (
      <div className="flex flex-col gap-6">
        <PermissionDenied description="Ask an admin to grant you the View customers permission if you think this is a mistake." />
      </div>
    );
  }

  const raw = await searchParams;
  const page = Number(firstValue(raw.page)) || 1;
  const search = firstValue(raw.search) ?? "";
  const campaignId = firstValue(raw.campaignId);
  const customerType = (firstValue(raw.customerType) ?? "all") as "all" | "GENERAL" | "VIP" | "VVIP";

  const [{ items, total, pageSize, page: currentPage }, { items: campaigns }] = await Promise.all([
    listVerifiedCustomers({ page, search, campaignId, customerType }),
    listCampaigns({ pageSize: 100 }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Verified Customers</h2>
        <p className="text-sm text-muted-foreground">
          Customers who completed at least one campaign profile form. A customer verified through
          multiple campaigns appears once per campaign.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <VerifiedCustomersToolbar />
            </div>
            <VerifiedCustomersCampaignFilter
              campaigns={campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name }))}
            />
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No verified customers found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Customer Type</TableHead>
                    <TableHead>Verified At</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={`${row.id}-${row.campaignId}`}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.campaignName}</TableCell>
                      <TableCell>{row.customerType}</TableCell>
                      <TableCell>{formatDateTime(row.verifiedAt)}</TableCell>
                      <TableCell>{row.dateOfBirth ?? "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">{row.address ?? "—"}</TableCell>
                      <TableCell>{row.email ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
