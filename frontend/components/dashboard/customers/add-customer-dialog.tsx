"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer } from "@/lib/api/customers";
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
  const [isVip, setIsVip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        isVip,
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
        <Input
          id="add-customer-dob"
          type="date"
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
        />
      </FormField>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="min-w-0">
          <Label htmlFor="add-customer-vip">VIP customer</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mark this customer as VIP.
          </p>
        </div>
        <Switch id="add-customer-vip" checked={isVip} onCheckedChange={setIsVip} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter showCloseButton>
        <Button type="submit" disabled={submitting || !name || !phone}>
          {submitting ? "Adding…" : "Add Customer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
