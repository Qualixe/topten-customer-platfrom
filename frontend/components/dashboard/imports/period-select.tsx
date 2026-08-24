import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/** "YYYY-MM" — straight from an `<input type="month">`. */
export type PeriodValue = string;

export function parsePeriod(value: PeriodValue): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function currentPeriod(): PeriodValue {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Which calendar month this POS export covers — required by the backend
 * (`period_year`/`period_month` on the import batch). */
export function PeriodSelect({
  value,
  onChange,
  disabled,
}: {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="import-period">
        Period <span className="text-destructive">*</span>
      </Label>
      <Input
        id="import-period"
        type="month"
        className="w-full sm:w-56"
        value={value}
        max={currentPeriod()}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      />
      <p className="text-xs text-muted-foreground">
        The calendar month this POS export covers.
      </p>
    </div>
  );
}
