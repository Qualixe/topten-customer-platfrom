import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import type { Block } from "@/components/campaign-builder/types";

const TODAY = new Date();

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
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{block.content.label || "Date of Birth"}</Label>
      {onChange ? (
        <DatePicker value={value} onChange={onChange} maxDate={TODAY} />
      ) : (
        <DatePicker value={undefined} onChange={() => {}} disabled={!preview} />
      )}
    </div>
  );
}
