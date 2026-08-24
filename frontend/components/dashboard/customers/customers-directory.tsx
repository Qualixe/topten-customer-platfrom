"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CustomerDetailsDialog } from "@/components/dashboard/customers/customer-details-dialog";
import { CustomersTable } from "@/components/dashboard/customers/customers-table";
import {
  buildCustomersHref,
  type CustomersUrlParams,
} from "@/components/dashboard/customers/customers-url";
import { DeleteCustomerDialog } from "@/components/dashboard/customers/delete-customer-dialog";
import { EditCustomerDialog } from "@/components/dashboard/customers/edit-customer-dialog";
import { PaginationBar } from "@/components/dashboard/customers/pagination-bar";
import type { Customer, CustomersSortBy } from "@/lib/api/customers";

/**
 * Renders the current page of customers plus pagination and sorting
 * controls. Holds no data itself — `customers`, `total`, `page`, and
 * `pageSize` all come from a server-side `listCustomers()` call for the
 * current URL, made by the parent Server Component. Every interaction here
 * (sorting, paging) navigates to a new URL rather than touching a local
 * copy of the dataset, so the entire customer list never has to reach the
 * browser at once.
 */
export function CustomersDirectory({
  customers,
  total,
  page,
  pageSize,
  current,
}: {
  customers: Customer[];
  total: number;
  page: number;
  pageSize: number;
  current: CustomersUrlParams;
}) {
  const router = useRouter();
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  function navigate(patch: Partial<CustomersUrlParams>) {
    router.push(buildCustomersHref(current, patch));
  }

  function handleViewCustomer(customer: Customer) {
    setViewingCustomer(customer);
    setViewDialogOpen(true);
  }

  function handleEditCustomer(customer: Customer) {
    setEditingCustomer(customer);
    setEditDialogOpen(true);
  }

  function handleDeleteCustomer(customer: Customer) {
    setDeletingCustomer(customer);
    setDeleteDialogOpen(true);
  }

  function handleSort(column: CustomersSortBy) {
    const nextDir =
      current.sortBy === column && current.sortDir === "asc" ? "desc" : "asc";
    navigate({ sortBy: column, sortDir: nextDir });
  }

  return (
    <div className="flex flex-col gap-4">
      <CustomersTable
        customers={customers}
        onViewCustomer={handleViewCustomer}
        onEditCustomer={handleEditCustomer}
        onDeleteCustomer={handleDeleteCustomer}
        sortBy={current.sortBy}
        sortDir={current.sortDir}
        onSort={handleSort}
      />

      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(target) => navigate({ page: target })}
      />

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
    </div>
  );
}
