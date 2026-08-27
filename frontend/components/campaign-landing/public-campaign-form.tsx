"use client";

import { useState, type FormEvent } from "react";
import { Check, RefreshCw } from "lucide-react";

import { BlockRenderer, type FormFieldName } from "@/components/campaign-builder/blocks";
import type { Block } from "@/components/campaign-builder/types";
import { Button } from "@/components/ui/button";
import { updatePublicCustomerProfile } from "@/lib/api/public-customer-profile";
import { customerProfileFormSchema } from "@/lib/validation/customer-profile-form";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Renders a campaign landing page's blocks as a real, working form —
 * decorative blocks (heading/text/image/button/divider/spacer) via the
 * same `BlockRenderer` the builder uses, the three form-field blocks
 * (date_of_birth/address/email) wired to real state and submitted through
 * the existing secure customer-profile endpoint. */
export function PublicCampaignForm({
  token,
  blocks,
  initialValues,
}: {
  token: string;
  blocks: Block[];
  initialValues: { dateOfBirth: string; address: string; email: string };
}) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleFieldChange(field: FormFieldName, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const result = customerProfileFormSchema.safeParse(values);
    if (!result.success) {
      setFieldErrors(Object.values(result.error.flatten().fieldErrors).flat());
      return;
    }
    setFieldErrors([]);
    setSubmitting(true);

    try {
      await updatePublicCustomerProfile(token, result.data);
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
        className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="size-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">Thank you!</h2>
        <p className="text-muted-foreground">Your information has been updated successfully.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
    >
      {blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          preview
          formValues={values}
          onFormFieldChange={handleFieldChange}
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

      <Button type="submit" disabled={submitting} className="h-12 w-full text-base">
        {submitting ? "Saving…" : "Save my details"}
      </Button>
    </form>
  );
}
