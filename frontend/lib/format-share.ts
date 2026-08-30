/** Percentage of `total`, rounded — except a genuinely nonzero count that
 * would round down to "0%" reads as "<1%" instead, so a real (if tiny)
 * share never looks identical to an actual zero. */
export function formatSharePercent(count: number, total: number): string {
  if (total <= 0) return "0%";
  const percent = (count / total) * 100;
  if (count > 0 && percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}
