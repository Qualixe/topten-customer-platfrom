"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";

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
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [types, setTypes] = useState<CustomerTypeOption[]>([]);
  // Every row in a new import gets freshly assigned to whatever's picked
  // here, so — unlike the edit-customer form — there's no "current value"
  // to preserve, and inactive types are hidden outright.
  const activeTypes = types.filter((type) => type.isActive);

  useEffect(() => {
    listCustomerTypes()
      .then(setTypes)
      .catch(() => {
        // Non-fatal — the select just stays empty; the "required" hint below
        // still guides the admin, and the request will fail loudly on submit.
      });
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="import-customer-type">
        Customer Type <span className="text-destructive">*</span>
      </Label>
      <Select
        value={value ?? undefined}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger id="import-customer-type" className="w-full sm:w-56">
          <SelectValue placeholder="Select a customer type…">
            {(selected: string) => activeTypes.find((t) => t.id === selected)?.name ?? "…"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {activeTypes.map((type) => (
            <SelectItem key={type.id} value={type.id}>
              {type.name}
            </SelectItem>
          ))}
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
