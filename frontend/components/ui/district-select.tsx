"use client"

import { BD_DISTRICTS } from "@/lib/bd-districts"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearchInput,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"

// Base UI's Combobox reserves "" to mean "nothing selected" (that's what
// shows the placeholder), so a real, selectable "clear" item — city being
// optional — needs its own sentinel value translated back to "" on change.
const CLEAR_VALUE = "__none__"

const ITEMS = [CLEAR_VALUE, ...BD_DISTRICTS]

/**
 * Searchable dropdown of Bangladesh's 64 districts for the "city" field —
 * replaces a free-text input everywhere city is collected. `value` is a
 * plain string (not necessarily one of BD_DISTRICTS: pre-existing data
 * entered before this dropdown existed may not match any item exactly, in
 * which case the trigger just shows the placeholder rather than a
 * selection — the underlying value is left untouched until the admin
 * actively picks one).
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
    <Combobox
      items={value ? ITEMS : BD_DISTRICTS}
      value={value || null}
      onValueChange={(next) => onChange(next === CLEAR_VALUE ? "" : ((next as string) ?? ""))}
      required={required}
      disabled={disabled}
    >
      <ComboboxTrigger id={id} className={className ?? "w-full"} aria-label={ariaLabel}>
        <ComboboxValue placeholder={placeholder} />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearchInput placeholder="Search districts…" />
        <ComboboxEmpty>No district found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item === CLEAR_VALUE ? "No district" : item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export { DistrictSelect }
