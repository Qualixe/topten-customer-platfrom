import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/form-builder/types";

export function EmailField({
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
      <Input
        type="email"
        placeholder={field.placeholder}
        disabled={!preview && !onChange}
        value={onChange ? (value ?? "") : undefined}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
    </div>
  );
}
