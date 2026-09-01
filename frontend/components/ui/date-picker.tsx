"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Parses a plain "YYYY-MM-DD" date (no time/timezone) into a local Date at
 * midnight — never `new Date(string)`, which parses as UTC and can render
 * as the wrong calendar day depending on the viewer's timezone offset. */
function parseDateOnly(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * A styled replacement for `<input type="date">` — the whole field is the
 * click target (not just a small icon), opening a popover calendar instead
 * of each browser's own inconsistently-styled native picker. Value/onChange
 * still speak plain "YYYY-MM-DD" strings, so it drops into existing form
 * state unchanged.
 */
function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  required,
  fromYear,
  toYear,
  minDate,
  maxDate,
  className,
}: {
  id?: string
  /** Plain "YYYY-MM-DD", or empty/undefined for no selection. */
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  /** Calendar's year-dropdown bounds. Defaults to react-day-picker's own
   * dropdown default (100 years back through the end of this year) — wide
   * enough for a date of birth without being explicitly configured. */
  fromYear?: number
  toYear?: number
  /** Dates strictly before/after these are shown but not selectable —
   * e.g. `minDate={new Date()}` to disallow scheduling into the past. */
  minDate?: Date
  maxDate?: Date
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDateOnly(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        aria-required={required}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
          !selected && "text-muted-foreground",
          className
        )}
      >
        <span className="truncate">
          {selected
            ? selected.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : placeholder}
        </span>
        <CalendarIcon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          startMonth={fromYear !== undefined ? new Date(fromYear, 0) : undefined}
          endMonth={toYear !== undefined ? new Date(toYear, 11) : undefined}
          captionLayout="dropdown"
          disabled={
            minDate || maxDate
              ? [
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]
              : undefined
          }
          onSelect={(date) => {
            if (date) {
              onChange(formatDateOnly(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
