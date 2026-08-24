import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Pencil, Trash2, Users } from "lucide-react";

import { CustomerStatusBadge } from "@/components/dashboard/customers/status-badge";
import { CustomerTierBadge } from "@/components/dashboard/customers/tier-badge";
import { CustomerTypeBadge } from "@/components/dashboard/customers/customer-type-badge";
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
import { cn } from "@/lib/utils";
import { formatCurrency, type Customer, type CustomersSortBy, type SortDirection } from "@/lib/api/customers";

function SortableHead({
  column,
  label,
  align,
  sortBy,
  sortDir,
  onSort,
}: {
  column: CustomersSortBy;
  label: string;
  align?: "right";
  sortBy: CustomersSortBy | undefined;
  sortDir: SortDirection;
  onSort: (column: CustomersSortBy) => void;
}) {
  const isActive = sortBy === column;
  const Icon = isActive ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
          isActive && "text-foreground",
          align === "right" && "flex-row-reverse"
        )}
        aria-label={`Sort by ${label}${isActive ? (sortDir === "asc" ? ", ascending" : ", descending") : ""}`}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

export function CustomersTable({
  customers,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  sortBy,
  sortDir,
  onSort,
}: {
  customers: Customer[];
  onViewCustomer: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  sortBy?: CustomersSortBy;
  sortDir: SortDirection;
  onSort: (column: CustomersSortBy) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <SortableHead
                column="name"
                label="Customer"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              <TableHead>Tier</TableHead>
              <TableHead>Customer Type</TableHead>
              <TableHead>Status</TableHead>
              <SortableHead
                column="totalOrders"
                label="Orders"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortableHead
                column="totalSpent"
                label="Total Spent"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    icon={Users}
                    title="No customers found"
                    description="Try adjusting your search, tier, or status filter."
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
                        {customer.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <CustomerTierBadge tier={customer.tier} />
                </TableCell>
                <TableCell>
                  <CustomerTypeBadge customerType={customer.customerType ?? "GENERAL"} />
                </TableCell>
                <TableCell>
                  <CustomerStatusBadge status={customer.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {customer.totalOrders}
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(customer.totalSpent)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {customer.joinedAt}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View ${customer.name}`}
                      onClick={() => onViewCustomer(customer)}
                    >
                      <Eye />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${customer.name}`}
                      onClick={() => onEditCustomer(customer)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${customer.name}`}
                      onClick={() => onDeleteCustomer(customer)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
