"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePublicCustomerProfile } from "@/lib/api/public-customer-profile";
import {
  customerProfileFormSchema,
  type CustomerProfileFormValues,
} from "@/lib/validation/customer-profile-form";
import { cn } from "@/lib/utils";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Large, thumb-friendly field sizing for a page opened from an SMS on a phone. */
const FIELD_CLASS = "h-12 text-base";

export function CustomerProfileForm({
  token,
  name,
  dateOfBirth,
  address,
  email,
}: {
  token: string;
  name: string;
  dateOfBirth: string | null;
  address: string | null;
  email: string | null;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerProfileFormValues>({
    resolver: zodResolver(customerProfileFormSchema),
    defaultValues: {
      dateOfBirth: dateOfBirth ?? "",
      address: address ?? "",
      email: email ?? "",
    },
  });

  async function onSubmit(values: CustomerProfileFormValues) {
    setSubmitError(null);

    try {
      await updatePublicCustomerProfile(token, values);
      setSubmitted(true);
    } catch {
      // Never surface the underlying API/database error — just a generic,
      // friendly retry prompt, per the "no technical errors" requirement.
      setSubmitError(GENERIC_ERROR_MESSAGE);
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">Thank you!</h2>
        <p className="text-muted-foreground">
          Your information has been updated successfully.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <p className="text-sm text-muted-foreground">
        Hi {name.split(" ")[0]}, please fill in the details below.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="date-of-birth">Date of birth</Label>
        <Input
          id="date-of-birth"
          type="date"
          inputMode="numeric"
          className={FIELD_CLASS}
          max={new Date().toISOString().slice(0, 10)}
          aria-invalid={!!errors.dateOfBirth}
          aria-describedby={errors.dateOfBirth ? "date-of-birth-error" : undefined}
          {...register("dateOfBirth")}
        />
        {errors.dateOfBirth && (
          <p id="date-of-birth-error" role="alert" className="text-sm text-destructive">
            {errors.dateOfBirth.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          rows={3}
          placeholder="House, road, area, city"
          className={cn(FIELD_CLASS, "h-auto min-h-24 resize-none")}
          aria-invalid={!!errors.address}
          aria-describedby={errors.address ? "address-error" : undefined}
          {...register("address")}
        />
        {errors.address && (
          <p id="address-error" role="alert" className="text-sm text-destructive">
            {errors.address.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">
          Email <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={FIELD_CLASS}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {submitError && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
        >
          <p className="text-sm text-destructive">{submitError}</p>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="h-12 w-full text-base">
        {isSubmitting ? "Saving…" : "Save my details"}
      </Button>
    </form>
  );
}
