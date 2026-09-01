import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/form-builder/types";

export function DateOfBirthField({
  field,
  preview = false,
  value,
  onChange,
}: {
  field: FormField;
  preview?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <DatePicker
        value={onChange ? value : undefined}
        onChange={onChange ?? (() => {})}
        disabled={!preview && !onChange}
      />
    </div>
  );
}
