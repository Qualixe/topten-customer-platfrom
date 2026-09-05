"use client";

import { useState, type FormEvent } from "react";
import { Check, RefreshCw } from "lucide-react";

import { FieldRenderer, type GenericFormValues } from "@/components/form-builder/fields";
import { Button } from "@/components/ui/button";
import { submitGenericForm } from "@/lib/api/forms";
import type { FormField } from "@/lib/form-builder/types";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const EMPTY_VALUES: GenericFormValues = {
  name: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  address: "",
  city: "",
};
// Matches Pathao's own minimum for a shippable address (see
// app/services/pathao.py) — checked whenever an address is given, not just
// when the form marks it required.
const MIN_ADDRESS_LENGTH = 10;

/** Renders a form's fields as a real, working, tokenless public form —
 * decorative fields (heading/paragraph/divider/submit button) via the same
 * FieldRenderer the builder uses, name/phone/email/date_of_birth/address
 * wired to real state and submitted to the open /public/forms/{slug}/submit
 * endpoint, which finds or creates a Customer by phone (no token, no
 * pre-existing customer required — unlike the campaign/token flow). */
export function PublicGenericForm({ slug, fields }: { slug: string; fields: FormField[] }) {
  const [values, setValues] = useState<GenericFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleFieldChange(field: keyof GenericFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string[] {
    const errors: string[] = [];
    if (!values.name.trim()) errors.push("Name is required.");
    if (!values.phone.trim()) errors.push("Phone number is required.");

    for (const field of fields) {
      if (!field.required) continue;
      if (field.type === "email" && !values.email.trim()) errors.push(`${field.label} is required.`);
      if (field.type === "date_of_birth" && !values.dateOfBirth.trim()) {
        errors.push(`${field.label} is required.`);
      }
      if (field.type === "address" && !values.address.trim()) errors.push(`${field.label} is required.`);
      if (field.type === "city" && !values.city.trim()) errors.push(`${field.label} is required.`);
    }

    if (values.address.trim() && values.address.trim().length < MIN_ADDRESS_LENGTH) {
      errors.push(`Please enter your full address (at least ${MIN_ADDRESS_LENGTH} characters).`);
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validate();
    if (errors.length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors([]);
    setSubmitting(true);

    try {
      await submitGenericForm(slug, {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
      });
      setSubmitted(true);
    } catch {
      // Never surface the underlying API/database error — a generic,
      // friendly retry prompt only.
      setSubmitError(GENERIC_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-[10px] border bg-card px-6 py-12 text-center shadow-lg"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">Thank you!</h2>
        <p className="text-muted-foreground">Your information has been submitted successfully.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-[10px] border bg-card p-6 shadow-lg sm:p-8"
    >
      {fields.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          preview
          formValues={values}
          onFormFieldChange={handleFieldChange}
          submitDisabled={submitting}
        />
      ))}

      {fieldErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          {fieldErrors.map((message) => (
            <p key={message} className="text-sm text-destructive">
              {message}
            </p>
          ))}
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
        >
          <p className="text-sm text-destructive">{submitError}</p>
          <Button type="submit" variant="outline" size="sm" disabled={submitting} className="gap-1.5">
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      {/* Fallback submit button — only shown when the admin didn't already
       * place a submit button field in the builder, which becomes the real
       * submit action itself (see FieldRenderer). Keeps a form built
       * without one still submittable. */}
      {!fields.some((field) => field.type === "submit_button") && (
        <Button type="submit" disabled={submitting} className="h-12 w-full text-base">
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      )}
    </form>
  );
}
