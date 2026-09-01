"use client"

import * as React from "react"
import { CalendarIcon, ClockIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** Splits a native `datetime-local` value ("YYYY-MM-DDTHH:mm") into a local
 * Date (midnight, date part only) and a plain "HH:mm" time string — never
 * `new Date(string)` on the whole thing, which parses as UTC and can shift
 * the calendar day depending on the viewer's timezone offset. */
function parseDateTimeLocal(value: string | undefined): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: "" }
  const [datePart, timePart] = value.split("T")
  if (!datePart) return { date: undefined, time: "" }
  const [year, month, day] = datePart.split("-").map(Number)
  if (!year || !month || !day) return { date: undefined, time: timePart ?? "" }
  return { date: new Date(year, month - 1, day), time: timePart ?? "" }
}

function formatDateTimeLocal(date: Date, time: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}T${time || "00:00"}`
}

function formatTimeDisplay(time: string): string {
  const [hourStr, minuteStr] = time.split(":")
  const hour = Number(hourStr)
  if (Number.isNaN(hour) || !minuteStr) return time
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${minuteStr} ${period}`
}

/**
 * A styled replacement for `<input type="datetime-local">` — the whole
 * field is the click target, opening a popover with the same calendar used
 * by `DatePicker` plus a time field, instead of each browser's own
 * inconsistently-styled native picker. Value/onChange still speak plain
 * "YYYY-MM-DDTHH:mm" strings, so it drops into existing form state
 * unchanged.
 */
function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date & time",
  disabled,
  required,
  minDate,
  maxDate,
  className,
}: {
  id?: string
  /** Plain "YYYY-MM-DDTHH:mm", or empty/undefined for no selection. */
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  minDate?: Date
  maxDate?: Date
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const { date: selected, time } = parseDateTimeLocal(value)

  function handleDateSelect(date: Date | undefined) {
    if (!date) return
    // Default to a sensible time on first pick so the value is immediately
    // valid, rather than leaving the datetime-local string time-less.
    onChange(formatDateTimeLocal(date, time || "09:00"))
  }

  function handleTimeChange(nextTime: string) {
    if (!nextTime) return
    onChange(formatDateTimeLocal(selected ?? new Date(), nextTime))
  }

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
            ? `${selected.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}${time ? `, ${formatTimeDisplay(time)}` : ""}`
            : placeholder}
        </span>
        <CalendarIcon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          captionLayout="dropdown"
          disabled={
            minDate || maxDate
              ? [
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]
              : undefined
          }
          onSelect={handleDateSelect}
        />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            type="time"
            value={time}
            onChange={(event) => handleTimeChange(event.target.value)}
            className="h-8"
            aria-label="Time"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker }
