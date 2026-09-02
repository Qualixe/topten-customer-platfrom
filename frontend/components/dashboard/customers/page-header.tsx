import { AddCustomerDialog } from "@/components/dashboard/customers/add-customer-dialog";

export function CustomersPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Customers</h2>
        <p className="text-sm text-muted-foreground">
          Browse, search, and manage every customer on the platform.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <AddCustomerDialog />
      </div>
    </div>
  );
}
