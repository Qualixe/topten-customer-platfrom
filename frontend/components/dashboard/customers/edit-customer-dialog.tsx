"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomer, type Customer, type CustomerStatus } from "@/lib/api/customers";
import { getErrorMessage } from "@/lib/api/types";

const STATUS_OPTIONS: CustomerStatus[] = ["Active", "Inactive", "Suspended"];

export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {customer && (
          // Keying by id forces a fresh form instance (and initial state)
          // whenever a different row is opened into this shared dialog.
          <EditCustomerForm
            key={customer.id}
            customer={customer}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditCustomerForm({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const router = useRouter();

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(
    customer.email === "No email on file" ? "" : customer.email
  );
  const [address, setAddress] = useState(customer.city === "—" ? "" : customer.city);
  const [dateOfBirth, setDateOfBirth] = useState((customer.dateOfBirth ?? "").slice(0, 10));
  const [statusValue, setStatusValue] = useState<CustomerStatus>(customer.status);
  const [isVip, setIsVip] = useState(customer.tier === "VIP");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await updateCustomer(customer.id, {
        name,
        phone,
        email: email.trim() || null,
        address: address.trim() || null,
        dateOfBirth: dateOfBirth || null,
        isVip,
        status: statusValue,
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
      <DialogHeader>
        <DialogTitle>Edit Customer</DialogTitle>
        <DialogDescription>Update {customer.name}&apos;s details.</DialogDescription>
      </DialogHeader>

      <FormField htmlFor="edit-customer-name" label="Name">
        <Input
          id="edit-customer-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </FormField>

      <FormField htmlFor="edit-customer-phone" label="Phone">
        <Input
          id="edit-customer-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
      </FormField>

      <FormField htmlFor="edit-customer-email" label="Email (optional)">
        <Input
          id="edit-customer-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>

      <FormField htmlFor="edit-customer-address" label="Address (optional)">
        <Textarea
          id="edit-customer-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="min-h-16 resize-none"
        />
      </FormField>

      <FormField htmlFor="edit-customer-dob" label="Date of birth (optional)">
        <DatePicker id="edit-customer-dob" value={dateOfBirth} onChange={setDateOfBirth} />
      </FormField>

      <FormField htmlFor="edit-customer-status" label="Status">
        <Select
          value={statusValue}
          onValueChange={(value) => setStatusValue(value as CustomerStatus)}
        >
          <SelectTrigger id="edit-customer-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="min-w-0">
          <Label htmlFor="edit-customer-vip">VIP customer</Label>
        </div>
        <Switch id="edit-customer-vip" checked={isVip} onCheckedChange={setIsVip} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter showCloseButton>
        <Button type="submit" disabled={submitting || !name || !phone}>
          {submitting ? "Saving…" : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
