"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";

import { CustomerDetailsDialog } from "@/components/dashboard/customers/customer-details-dialog";
import { CustomerNotePopover } from "@/components/dashboard/customers/customer-note-popover";
import { DeleteCustomerDialog } from "@/components/dashboard/customers/delete-customer-dialog";
import { EditCustomerDialog } from "@/components/dashboard/customers/edit-customer-dialog";
import { usePermissions } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer, VerifiedCustomerRow, VerifiedCustomerSource } from "@/lib/api/customers";

// campaign's own row always has a real campaignName, so this is never
// actually rendered for that source — present only to keep the Record
// exhaustive over VerifiedCustomerSource.
const SOURCE_LABELS: Record<VerifiedCustomerSource, string> = {
  campaign: "",
  form: "Standalone form",
  admin: "Manually verified",
};

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

/** Same View/Note/Edit/Delete actions as the main Customers table — each
 * row already carries its full `Customer` record (see
 * VerifiedCustomerRow.customer), so these reuse the exact same dialogs
 * without a second round trip. */
export function VerifiedCustomersTable({ items }: { items: VerifiedCustomerRow[] }) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("customers.manage");

  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function handleView(customer: Customer) {
    setViewingCustomer(customer);
    setViewDialogOpen(true);
  }

  function handleEdit(customer: Customer) {
    setEditingCustomer(customer);
    setEditDialogOpen(true);
  }

  function handleDelete(customer: Customer) {
    setDeletingCustomer(customer);
    setDeleteDialogOpen(true);
  }

  return (
    <>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={`${row.id}-${row.source}`}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>
                  {row.campaignName ?? (
                    <span className="text-muted-foreground">{SOURCE_LABELS[row.source]}</span>
                  )}
                </TableCell>
                <TableCell>{row.customerType.name}</TableCell>
                <TableCell>{formatDateTime(row.verifiedAt)}</TableCell>
                <TableCell>{row.dateOfBirth ?? "—"}</TableCell>
                <TableCell className="max-w-48 truncate">{row.address ?? "—"}</TableCell>
                <TableCell>{row.email ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View ${row.name}`}
                      onClick={() => handleView(row.customer)}
                    >
                      <Eye />
                    </Button>
                    {canManage && (
                      <>
                        <CustomerNotePopover customer={row.customer} />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => handleEdit(row.customer)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => handleDelete(row.customer)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CustomerDetailsDialog
        customer={viewingCustomer}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />

      <EditCustomerDialog
        customer={editingCustomer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <DeleteCustomerDialog
        customer={deletingCustomer}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  );
}
