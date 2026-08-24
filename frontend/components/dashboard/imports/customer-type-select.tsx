import { AlertCircle } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomerType } from "@/lib/mock/customers";

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
};

/**
 * Required first step of the import flow — every row in the uploaded file
 * is imported/updated under whichever category is selected here. Uploading
 * is disabled until a value is chosen (see ImportsWorkspace).
 */
export function CustomerTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: CustomerType | null;
  onChange: (value: CustomerType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="import-customer-type">
        Customer Type <span className="text-destructive">*</span>
      </Label>
      <Select
        value={value ?? undefined}
        onValueChange={(next) => onChange(next as CustomerType)}
        disabled={disabled}
      >
        <SelectTrigger id="import-customer-type" className="w-full sm:w-56">
          <SelectValue placeholder="Select a customer type…">
            {(selected: CustomerType) => CUSTOMER_TYPE_LABELS[selected]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="GENERAL">General</SelectItem>
          <SelectItem value="VIP">VIP</SelectItem>
          <SelectItem value="VVIP">VVIP</SelectItem>
        </SelectContent>
      </Select>
      {!value && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          Select which customer category this file belongs to before uploading.
        </p>
      )}
    </div>
  );
}
