import { AddCustomerDialog } from "@/components/dashboard/customers/add-customer-dialog";

export function PageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">
          A snapshot of your customer platform, updated in real time.
        </p>
      </div>
      <AddCustomerDialog />
    </div>
  );
}
