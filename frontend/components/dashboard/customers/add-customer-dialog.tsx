"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { ManageCustomerTypesDialog } from "@/components/dashboard/customers/manage-customer-types-dialog";
import { usePermissions } from "@/components/providers/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer } from "@/lib/api/customers";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import { getErrorMessage } from "@/lib/api/types";

export function AddCustomerDialog() {
  const [open, setOpen] = useState(false);
  const { hasPermission } = usePermissions();

  if (!hasPermission("customers.manage")) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus />
            Add Customer
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>
            Creates a real customer record in the database.
          </DialogDescription>
        </DialogHeader>

        <AddCustomerForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddCustomerForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);
  // "" (not undefined) from the first render — a Base UI Select is
  // controlled once its value is ever non-undefined, and switching from
  // uncontrolled to controlled after the async fetch resolves logs a
  // React warning.
  const [customerTypeId, setCustomerTypeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only active types are offered for a brand-new customer — an inactive
  // one has no history to preserve here, unlike the edit form.
  const activeTypes = types.filter((type) => type.isActive);

  useEffect(() => {
    listCustomerTypes()
      .then((fetched) => {
        setTypes(fetched);
        setCustomerTypeId((current) => current || fetched.find((t) => t.name === "General")?.id || "");
      })
      .catch(() => {
        // Non-fatal — omitting customerTypeId defaults to General server-side.
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createCustomer({
        name,
        phone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        customerTypeId: customerTypeId || undefined,
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to reach the API server. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField htmlFor="add-customer-name" label="Name">
        <Input
          id="add-customer-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Rahim Uddin"
          required
        />
      </FormField>

      <FormField
        htmlFor="add-customer-phone"
        label="Phone"
        description="Bangladeshi number, e.g. 01711000101"
      >
        <Input
          id="add-customer-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="01711000101"
          required
        />
      </FormField>

      <FormField htmlFor="add-customer-email" label="Email (optional)">
        <Input
          id="add-customer-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="rahim@example.com"
        />
      </FormField>

      <FormField htmlFor="add-customer-address" label="Address (optional)">
        <Textarea
          id="add-customer-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="min-h-16 resize-none"
          placeholder="e.g. Dhanmondi, Dhaka"
        />
      </FormField>

      <FormField htmlFor="add-customer-dob" label="Date of birth (optional)">
        <DatePicker id="add-customer-dob" value={dateOfBirth} onChange={setDateOfBirth} />
      </FormField>

      <FormField htmlFor="add-customer-type" label="Customer Type">
        <div className="flex items-center gap-2">
          <Select
            value={customerTypeId}
            onValueChange={(value) => setCustomerTypeId(value ?? "")}
          >
            <SelectTrigger id="add-customer-type" className="w-full">
              <SelectValue>
                {(value: string) => activeTypes.find((t) => t.id === value)?.name ?? "General"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {activeTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ManageCustomerTypesDialog types={types} onTypesChange={setTypes} />
        </div>
      </FormField>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter showCloseButton>
        <Button type="submit" disabled={submitting || !name || !phone}>
          {submitting ? "Adding…" : "Add Customer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
