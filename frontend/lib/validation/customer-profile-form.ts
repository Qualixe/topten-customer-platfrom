import { z } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AGE_YEARS = 120;

/**
 * Client-side validation only speeds up feedback — the FastAPI backend
 * re-validates everything (required fields, email format, date range)
 * independently and is the actual source of truth.
 */
function isReasonableDateOfBirth(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  if (date > today) return false;

  const earliest = new Date(today);
  earliest.setFullYear(earliest.getFullYear() - MAX_AGE_YEARS);
  return date >= earliest;
}

export const customerProfileFormSchema = z.object({
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine(isReasonableDateOfBirth, "Please enter a valid date of birth"),
  address: z
    .string()
    .trim()
    .min(10, "Please enter your full address (at least 10 characters)")
    .max(500, "Address is too long"),
  email: z
    .string()
    .trim()
    .max(255, "Email is too long")
    .refine(
      (value) => value === "" || EMAIL_PATTERN.test(value),
      "Please enter a valid email address"
    ),
});

export type CustomerProfileFormValues = z.infer<typeof customerProfileFormSchema>;
