import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Block } from "@/components/campaign-builder/types";

/** A form field placeholder in the builder — disabled everywhere except
 * preview mode. On the real public page, `value`/`onChange` are passed so
 * this becomes a genuinely working input connected to the actual
 * submission form (see app/campaign/[slug]/page.tsx). */
export function DateOfBirthBlock({
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
      <Label>{block.content.label || "Date of Birth"}</Label>
      {onChange ? (
        <Input
          type="date"
          value={value ?? ""}
          onChange={handleChange}
          max={new Date().toISOString().slice(0, 10)}
        />
      ) : (
        <Input type="date" disabled={!preview} />
      )}
    </div>
  );
}
