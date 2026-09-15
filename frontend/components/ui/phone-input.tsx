import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** A phone `<Input>` with a fixed, decorative "🇧🇩 +880" badge in front —
 * the value itself still starts with 0 (local format, e.g. 01712345678),
 * matching what the backend's phone normalization expects. */
function PhoneInput({
  className,
  "aria-invalid": ariaInvalid,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div
      className={cn(
        "flex h-8 w-full items-stretch overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        ariaInvalid && "border-destructive ring-3 ring-destructive/20",
        className
      )}
    >
      <span className="flex select-none items-center whitespace-nowrap border-r border-input bg-muted px-2 text-sm text-muted-foreground">
        🇧🇩 +880
      </span>
      <Input
        type="tel"
        aria-invalid={ariaInvalid}
        {...props}
        className="h-auto flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
    </div>
  )
}

export { PhoneInput }
