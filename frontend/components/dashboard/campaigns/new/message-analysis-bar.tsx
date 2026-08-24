import { cn } from "@/lib/utils";
import type { SmsAnalysis } from "@/lib/sms";

/**
 * Compact live stats row shown below the message textarea.
 * Renders character count, encoding badge, segments, and remaining chars.
 */
export function MessageAnalysisBar({ analysis }: { analysis: SmsAnalysis }) {
  const { encoding, characterCount, segmentCount, remainingCharacters } =
    analysis;

  const isUnicode = encoding === "UCS-2";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {/* Char count */}
      <span>
        <span className="font-medium text-foreground">
          {characterCount}
        </span>{" "}
        chars
      </span>

      {/* Encoding badge */}
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 font-medium",
          isUnicode
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
        )}
      >
        {encoding}
      </span>

      {/* Segment count */}
      <span>
        <span className="font-medium text-foreground">{segmentCount}</span>{" "}
        SMS segment{segmentCount !== 1 ? "s" : ""}
      </span>

      {/* Remaining */}
      <span>
        <span
          className={cn(
            "font-medium",
            remainingCharacters <= 10
              ? "text-destructive"
              : "text-foreground"
          )}
        >
          {remainingCharacters}
        </span>{" "}
        remaining in segment
      </span>

      {isUnicode && (
        <span className="text-amber-600 dark:text-amber-400">
          Unicode detected — lower per-segment capacity
        </span>
      )}
    </div>
  );
}
