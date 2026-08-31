import Link from "next/link";
import { Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, type Customer } from "@/lib/api/customers";

export function CustomerOverview({ customers }: { customers: Customer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Overview</CardTitle>
        <CardDescription>Most recently added customers</CardDescription>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Customers will show up here once they're imported or added to the platform."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                    <Badge variant={customer.tier === "VIP" ? "secondary" : "outline"}>
                      {customer.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={customer.status === "Active" ? "default" : "outline"}
                    >
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {customer.totalOrders}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatCurrency(customer.totalSpent)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.joinedAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Link
          href="/dashboard/customers"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          View all customers
        </Link>
      </CardContent>
    </Card>
  );
}
