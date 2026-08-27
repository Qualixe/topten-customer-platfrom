import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Block } from "@/components/campaign-builder/types";

/** See DateOfBirthBlock's comment — same builder-preview vs. real-form
 * pattern. */
export function AddressBlock({
  block,
  preview = false,
  value,
  onChange,
}: {
  block: Block;
  preview?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{block.content.label || "Address"}</Label>
      {onChange ? (
        <Input
          type="text"
          placeholder="Street, city, postcode"
          value={value ?? ""}
          onChange={handleChange}
        />
      ) : (
        <Input type="text" placeholder="Street, city, postcode" disabled={!preview} />
      )}
    </div>
  );
}
