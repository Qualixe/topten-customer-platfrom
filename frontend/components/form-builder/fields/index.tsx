import { AddressField } from "@/components/form-builder/fields/AddressField";
import { DateOfBirthField } from "@/components/form-builder/fields/DateOfBirthField";
import { DividerField } from "@/components/form-builder/fields/DividerField";
import { EmailField } from "@/components/form-builder/fields/EmailField";
import { HeadingField } from "@/components/form-builder/fields/HeadingField";
import { ParagraphField } from "@/components/form-builder/fields/ParagraphField";
import { PhoneField } from "@/components/form-builder/fields/PhoneField";
import { SubmitButtonField } from "@/components/form-builder/fields/SubmitButtonField";
import { TextField } from "@/components/form-builder/fields/TextField";
import type { FormField } from "@/lib/form-builder/types";

/** Picks the right component for a field's type. Used identically by the
 * builder canvas (disabled previews) and the preview screen (enabled
 * inputs, via `preview`) — the single place that maps type -> component, so
 * a future public form can reuse it too without duplicating this switch. */
export function FieldRenderer({ field, preview = false }: { field: FormField; preview?: boolean }) {
  switch (field.type) {
    case "heading":
      return <HeadingField field={field} />;
    case "paragraph":
      return <ParagraphField field={field} />;
    case "text":
      return <TextField field={field} preview={preview} />;
    case "email":
      return <EmailField field={field} preview={preview} />;
    case "phone":
      return <PhoneField field={field} preview={preview} />;
    case "date_of_birth":
      return <DateOfBirthField field={field} preview={preview} />;
    case "address":
      return <AddressField field={field} preview={preview} />;
    case "divider":
      return <DividerField />;
    case "submit_button":
      return <SubmitButtonField field={field} />;
    default:
      return null;
  }
}
