"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";

import { CustomerTypeSelect } from "@/components/dashboard/customers/customer-type-select";
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
import { DistrictSelect } from "@/components/ui/district-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer } from "@/lib/api/customers";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import { getErrorMessage } from "@/lib/api/types";
import { validateBdPhone } from "@/lib/validation/bd-phone";
import { validatePersonName } from "@/lib/validation/person-name";

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
  const [city, setCity] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);
  // "" (not undefined) from the first render — a Base UI Select is
  // controlled once its value is ever non-undefined, and switching from
  // uncontrolled to controlled after the async fetch resolves logs a
  // React warning.
  const [customerTypeId, setCustomerTypeId] = useState("");
  const [verified, setVerified] = useState(false);
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
    setError(null);

    const nameError = validatePersonName(name);
    if (nameError) {
      setError(`Name: ${nameError}`);
      return;
    }

    const phoneError = validateBdPhone(phone);
    if (phoneError) {
      setError(`Phone: ${phoneError}`);
      return;
    }

    setSubmitting(true);

    try {
      await createCustomer({
        name,
        phone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        internalNotes: internalNotes.trim() || undefined,
        customerTypeId: customerTypeId || undefined,
        isVerified: verified,
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

      <FormField htmlFor="add-customer-phone" label="Phone">
        <PhoneInput
          id="add-customer-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="01712345678"
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

      <FormField htmlFor="add-customer-city" label="City (optional)">
        <DistrictSelect id="add-customer-city" value={city} onChange={setCity} />
      </FormField>

      <FormField htmlFor="add-customer-dob" label="Date of birth (optional)">
        <DatePicker id="add-customer-dob" value={dateOfBirth} onChange={setDateOfBirth} />
      </FormField>

      <FormField htmlFor="add-customer-type" label="Customer Type">
        <div className="flex items-center gap-2">
          <CustomerTypeSelect
            id="add-customer-type"
            options={activeTypes}
            types={types}
            onTypesChange={setTypes}
            value={customerTypeId}
            onChange={setCustomerTypeId}
          />
          <ManageCustomerTypesDialog types={types} onTypesChange={setTypes} />
        </div>
      </FormField>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="min-w-0">
          <Label htmlFor="add-customer-verified">Verified customer</Label>
          <p className="text-xs text-muted-foreground">
            Manually add this customer to the Verified Customers list.
          </p>
        </div>
        <Switch id="add-customer-verified" checked={verified} onCheckedChange={setVerified} />
      </div>

      <FormField
        htmlFor="add-customer-notes"
        label="Internal Notes (optional)"
        description="Staff-only — never shown to the customer."
      >
        <Textarea
          id="add-customer-notes"
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
          className="min-h-16 resize-none"
          placeholder="e.g. Prefers home delivery, called about a refund on 5 Sep"
        />
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
