import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/form-builder/types";

/** `preview` enables the input (so it feels real on the Preview screen);
 * `value`/`onChange` are optional so a future public form can turn this
 * into a fully controlled input without changing this component. */
export function TextField({
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
        placeholder={field.placeholder}
        disabled={!preview && !onChange}
        value={onChange ? (value ?? "") : undefined}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
    </div>
  );
}
