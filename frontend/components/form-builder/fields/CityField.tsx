import { DistrictSelect } from "@/components/ui/district-select";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/form-builder/types";

export function CityField({
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
      <DistrictSelect
        placeholder={field.placeholder || "Select a district"}
        disabled={!preview && !onChange}
        value={value ?? ""}
        onChange={onChange ?? (() => {})}
      />
    </div>
  );
}
