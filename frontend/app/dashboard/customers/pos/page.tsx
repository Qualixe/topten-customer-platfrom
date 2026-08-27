import { Users } from "lucide-react";

import { PermissionDenied } from "@/components/dashboard/permission-denied";
import { PosCustomersPagination } from "@/components/dashboard/customers-pos/pos-customers-pagination";
import { PosCustomersToolbar } from "@/components/dashboard/customers-pos/pos-customers-toolbar";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, listPosCustomers, type ProfileStatus } from "@/lib/api/customers";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

function ProfileStatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <Badge
      className={
        status === "COMPLETE"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
      }
    >
      {status === "COMPLETE" ? "Complete" : "Incomplete"}
    </Badge>
  );
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PosCustomersPage({
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
  const customerType = (firstValue(raw.customerType) ?? "all") as "all" | "GENERAL" | "VIP" | "VVIP";
  const profileStatus = (firstValue(raw.profileStatus) ?? "all") as ProfileStatus | "all";

  const { items, total, pageSize, page: currentPage } = await listPosCustomers({
    page,
    search,
    customerType,
    profileStatus,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">POS Customers</h2>
        <p className="text-sm text-muted-foreground">
          Every customer in the master table — originating from POS imports or added by hand.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <PosCustomersToolbar />

          {items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Customer Type</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Profile Status</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{customer.customerType}</TableCell>
                      <TableCell>{customer.dateOfBirth ?? "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {customer.address ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ProfileStatusBadge status={customer.profileStatus} />
                      </TableCell>
                      <TableCell>{formatCurrency(customer.totalSpent)}</TableCell>
                      <TableCell>{formatDate(customer.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <PosCustomersPagination
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
