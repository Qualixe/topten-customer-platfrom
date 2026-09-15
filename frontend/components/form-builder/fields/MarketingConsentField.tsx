import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/form-builder/types";

export function MarketingConsentField({
  field,
  preview = false,
  checked,
  onChange,
  error,
}: {
  field: FormField;
  preview?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <Checkbox
          id={`field-${field.id}`}
          checked={onChange ? (checked ?? false) : false}
          disabled={!preview && !onChange}
          onCheckedChange={onChange}
          className="mt-0.5"
        />
        <Label htmlFor={`field-${field.id}`} className="font-normal">
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
