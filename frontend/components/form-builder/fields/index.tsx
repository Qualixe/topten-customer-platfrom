import { AddressField } from "@/components/form-builder/fields/AddressField";
import { CityField } from "@/components/form-builder/fields/CityField";
import { CustomerNoteField } from "@/components/form-builder/fields/CustomerNoteField";
import { DateOfBirthField } from "@/components/form-builder/fields/DateOfBirthField";
import { DividerField } from "@/components/form-builder/fields/DividerField";
import { EmailField } from "@/components/form-builder/fields/EmailField";
import { HeadingField } from "@/components/form-builder/fields/HeadingField";
import { MarketingConsentField } from "@/components/form-builder/fields/MarketingConsentField";
import { NameField } from "@/components/form-builder/fields/NameField";
import { ParagraphField } from "@/components/form-builder/fields/ParagraphField";
import { PhoneField } from "@/components/form-builder/fields/PhoneField";
import { SubmitButtonField } from "@/components/form-builder/fields/SubmitButtonField";
import type { FormField } from "@/lib/form-builder/types";

export type GenericFormFieldName =
  | "name"
  | "phone"
  | "email"
  | "dateOfBirth"
  | "address"
  | "city"
  | "marketingOptIn"
  | "customerNote";

/** Values for a real submission — only present on the public, tokenless
 * /form/[slug] page, where name/phone/email/date_of_birth/address/city turn
 * from disabled previews into real controlled inputs. */
export interface GenericFormValues {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
  city: string;
  marketingOptIn: boolean;
  customerNote: string;
}

/** Picks the right component for a field's type. Used identically by the
 * builder canvas (disabled previews), the Preview screen (enabled inputs,
 * via `preview`), and the real public form (`formValues`/`onFormFieldChange`
 * — only ever passed there) — the single place that maps type -> component,
 * so a future change never has to be made in more than one spot. */
export function FieldRenderer({
  field,
  preview = false,
  formValues,
  onFormFieldChange,
  submitDisabled = false,
  fieldErrors,
}: {
  field: FormField;
  preview?: boolean;
  formValues?: GenericFormValues;
  onFormFieldChange?: (field: GenericFormFieldName, value: string | boolean) => void;
  /** Only meaningful for a "submit_button" field on the real public form —
   * disables it while a submission is in flight. */
  submitDisabled?: boolean;
  /** Per-field validation messages, shown under that field's input — only
   * ever passed on the real public form (see PublicGenericForm). */
  fieldErrors?: Partial<Record<GenericFormFieldName, string>>;
}) {
  switch (field.type) {
    case "heading":
      return <HeadingField field={field} />;
    case "paragraph":
      return <ParagraphField field={field} />;
    case "name":
      return (
        <NameField
          field={field}
          preview={preview}
          value={formValues?.name}
          onChange={onFormFieldChange ? (value) => onFormFieldChange("name", value) : undefined}
          error={fieldErrors?.name}
        />
      );
    case "email":
      return (
        <EmailField
          field={field}
          preview={preview}
          value={formValues?.email}
          onChange={onFormFieldChange ? (value) => onFormFieldChange("email", value) : undefined}
          error={fieldErrors?.email}
        />
      );
    case "phone":
      return (
        <PhoneField
          field={field}
          preview={preview}
          value={formValues?.phone}
          onChange={onFormFieldChange ? (value) => onFormFieldChange("phone", value) : undefined}
          error={fieldErrors?.phone}
        />
      );
    case "date_of_birth":
      return (
        <DateOfBirthField
          field={field}
          preview={preview}
          value={formValues?.dateOfBirth}
          onChange={
            onFormFieldChange ? (value) => onFormFieldChange("dateOfBirth", value) : undefined
          }
          error={fieldErrors?.dateOfBirth}
        />
      );
    case "address":
      return (
        <AddressField
          field={field}
          preview={preview}
          value={formValues?.address}
          onChange={onFormFieldChange ? (value) => onFormFieldChange("address", value) : undefined}
          error={fieldErrors?.address}
        />
      );
    case "city":
      return (
        <CityField
          field={field}
          preview={preview}
          value={formValues?.city}
          onChange={onFormFieldChange ? (value) => onFormFieldChange("city", value) : undefined}
          error={fieldErrors?.city}
        />
      );
    case "marketing_consent":
      return (
        <MarketingConsentField
          field={field}
          preview={preview}
          checked={formValues?.marketingOptIn}
          onChange={
            onFormFieldChange ? (value) => onFormFieldChange("marketingOptIn", value) : undefined
          }
          error={fieldErrors?.marketingOptIn}
        />
      );
    case "customer_note":
      return (
        <CustomerNoteField
          field={field}
          preview={preview}
          value={formValues?.customerNote}
          onChange={
            onFormFieldChange ? (value) => onFormFieldChange("customerNote", value) : undefined
          }
          error={fieldErrors?.customerNote}
        />
      );
    case "divider":
      return <DividerField />;
    case "submit_button":
      return (
        <SubmitButtonField
          field={field}
          type={onFormFieldChange ? "submit" : "button"}
          disabled={Boolean(onFormFieldChange) && submitDisabled}
        />
      );
    default:
      return null;
  }
}
