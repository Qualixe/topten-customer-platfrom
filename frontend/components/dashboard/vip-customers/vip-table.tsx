import { Crown, Eye } from "lucide-react";

import { VipSegmentBadge } from "@/components/dashboard/vip-customers/vip-segment-badge";
import { VipStatusBadge } from "@/components/dashboard/vip-customers/vip-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, type VipCustomer } from "@/lib/api/vip-customers";

export function VipTable({
  customers,
  onViewCustomer,
}: {
  customers: VipCustomer[];
  onViewCustomer: (customer: VipCustomer) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Spent</TableHead>
              <TableHead>Last Purchase</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Crown}
                    title="No VIP customers found"
                    description="Try adjusting your search or filters."
                  />
                </TableCell>
              </TableRow>
            )}
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{customer.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {customer.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.email ?? "No email on file"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <VipSegmentBadge segment={customer.segment} />
                </TableCell>
                <TableCell>
                  <VipStatusBadge status={customer.status} />
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">
                    {formatCurrency(customer.totalSpent)}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground">
                    {customer.lastPurchaseLabel}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`View ${customer.name}`}
                    onClick={() => onViewCustomer(customer)}
                  >
                    <Eye />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
