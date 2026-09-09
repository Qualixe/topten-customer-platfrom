"use client"

import { BD_DISTRICTS } from "@/lib/bd-districts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Base UI's Select reserves "" to mean "nothing selected" (that's what
// shows the placeholder), so a real, selectable "clear" item — city being
// optional — needs its own sentinel value translated back to "" on change.
const CLEAR_VALUE = "__none__"

/**
 * Dropdown of Bangladesh's 64 districts for the "city" field — replaces a
 * free-text input everywhere city is collected. `value` is a plain string
 * (not necessarily one of BD_DISTRICTS: pre-existing data entered before
 * this dropdown existed may not match any item exactly, in which case the
 * trigger just shows the placeholder rather than a selection — the
 * underlying value is left untouched until the admin actively picks one).
 */
function DistrictSelect({
  id,
  value,
  onChange,
  placeholder = "Select a district",
  disabled,
  required,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(next) => onChange(next === CLEAR_VALUE ? "" : (next ?? ""))}
      required={required}
    >
      <SelectTrigger
        id={id}
        className={className ?? "w-full"}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {value && <SelectItem value={CLEAR_VALUE}>No district</SelectItem>}
        {BD_DISTRICTS.map((district) => (
          <SelectItem key={district} value={district}>
            {district}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { DistrictSelect }
