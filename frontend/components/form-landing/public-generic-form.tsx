"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, RefreshCw } from "lucide-react";

import {
  FieldRenderer,
  type GenericFormFieldName,
  type GenericFormValues,
} from "@/components/form-builder/fields";
import { Button } from "@/components/ui/button";
import { submitGenericForm } from "@/lib/api/forms";
import type { FormField } from "@/lib/form-builder/types";
import { validateBdPhone } from "@/lib/validation/bd-phone";
import { validatePersonName } from "@/lib/validation/person-name";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const EMPTY_VALUES: GenericFormValues = {
  name: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  address: "",
  city: "",
  marketingOptIn: false,
  customerNote: "",
};
// Matches Pathao's own minimum for a shippable address (see
// app/services/pathao.py) — checked whenever an address is given, not just
// when the form marks it required.
const MIN_ADDRESS_LENGTH = 10;

/** Validates a single field against its current value and that field's own
 * config on this form (for `required`/`label`) — shared by the on-change
 * (immediate, per-field) and on-submit (full form) checks so the two can
 * never drift apart. */
function validateField(
  field: GenericFormFieldName,
  values: GenericFormValues,
  fields: FormField[]
): string | undefined {
  switch (field) {
    case "name":
      return validatePersonName(values.name) ?? undefined;
    case "phone":
      return validateBdPhone(values.phone) ?? undefined;
    case "email": {
      const config = fields.find((f) => f.type === "email");
      if (config?.required && !values.email.trim()) return `${config.label} is required.`;
      return undefined;
    }
    case "dateOfBirth": {
      const config = fields.find((f) => f.type === "date_of_birth");
      if (config?.required && !values.dateOfBirth.trim()) return `${config.label} is required.`;
      return undefined;
    }
    case "address": {
      const config = fields.find((f) => f.type === "address");
      const trimmed = values.address.trim();
      if (config?.required && !trimmed) return `${config.label} is required.`;
      if (trimmed && trimmed.length < MIN_ADDRESS_LENGTH) return `At least ${MIN_ADDRESS_LENGTH} characters.`;
      return undefined;
    }
    case "city": {
      const config = fields.find((f) => f.type === "city");
      if (config?.required && !values.city.trim()) return `${config.label} is required.`;
      return undefined;
    }
    case "marketingOptIn": {
      const config = fields.find((f) => f.type === "marketing_consent");
      if (config?.required && !values.marketingOptIn) return "Please check the box.";
      return undefined;
    }
    case "customerNote": {
      const config = fields.find((f) => f.type === "customer_note");
      if (config?.required && !values.customerNote.trim()) return `${config.label} is required.`;
      return undefined;
    }
  }
}

const ALL_FIELD_NAMES: GenericFormFieldName[] = [
  "name",
  "phone",
  "email",
  "dateOfBirth",
  "address",
  "city",
  "marketingOptIn",
  "customerNote",
];

/** Renders a form's fields as a real, working, tokenless public form —
 * decorative fields (heading/paragraph/divider/submit button) via the same
 * FieldRenderer the builder uses, name/phone/email/date_of_birth/address
 * wired to real state and submitted to the open /public/forms/{slug}/submit
 * endpoint, which finds or creates a Customer by phone (no token, no
 * pre-existing customer required — unlike the campaign/token flow). */
export function PublicGenericForm({
  slug,
  fields,
  logo,
}: {
  slug: string;
  fields: FormField[];
  logo: ReactNode;
}) {
  const [values, setValues] = useState<GenericFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<GenericFormFieldName, string>>>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleFieldChange(field: keyof GenericFormValues, value: string | boolean) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);

    // Validate immediately, not just on submit — the visitor sees a
    // mistake (or sees it clear) as they type, rather than only after
    // trying to submit the whole form.
    const error = validateField(field, nextValues, fields);
    setFieldErrors((prev) => {
      if (!error) {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: error };
    });
  }

  function validate(): Partial<Record<GenericFormFieldName, string>> {
    const errors: Partial<Record<GenericFormFieldName, string>> = {};
    for (const name of ALL_FIELD_NAMES) {
      const error = validateField(name, values, fields);
      if (error) errors[name] = error;
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      await submitGenericForm(slug, {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        marketingOptIn: values.marketingOptIn,
        customerNote: values.customerNote || undefined,
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
        {logo}
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
      {logo}

      {fields.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          preview
          formValues={values}
          onFormFieldChange={handleFieldChange}
          submitDisabled={submitting}
          fieldErrors={fieldErrors}
        />
      ))}

      {Object.keys(fieldErrors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Please fix the highlighted field{Object.keys(fieldErrors).length > 1 ? "s" : ""} above.
        </p>
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
