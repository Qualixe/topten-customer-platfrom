/** Fixed buckets for the Customers page's "Spend Range" filter, each a
 * [min, max) — a customer at exactly a bucket's upper boundary belongs to
 * the *next* bucket, matching the backend's filter (see
 * app.controllers.customers._build_customer_filters). `max: undefined`
 * marks the open-ended top bucket ("500k+"). Values are plain Taka
 * amounts (this app's only currency), not paisa/cents. */
export interface SpendRange {
  /** Stable key for the URL/API — never changes even if the label does. */
  key: string;
  label: string;
  min: number;
  max?: number;
}

export const SPEND_RANGES: readonly SpendRange[] = [
  { key: "0-50k", label: "৳0 - ৳50k", min: 0, max: 50_000 },
  { key: "50k-100k", label: "৳50k - ৳100k", min: 50_000, max: 100_000 },
  { key: "100k-150k", label: "৳100k - ৳150k", min: 100_000, max: 150_000 },
  { key: "150k-200k", label: "৳150k - ৳200k", min: 150_000, max: 200_000 },
  { key: "200k-250k", label: "৳200k - ৳250k", min: 200_000, max: 250_000 },
  { key: "250k-300k", label: "৳250k - ৳300k", min: 250_000, max: 300_000 },
  { key: "300k-350k", label: "৳300k - ৳350k", min: 300_000, max: 350_000 },
  { key: "350k-400k", label: "৳350k - ৳400k", min: 350_000, max: 400_000 },
  { key: "400k-450k", label: "৳400k - ৳450k", min: 400_000, max: 450_000 },
  { key: "450k-500k", label: "৳450k - ৳500k", min: 450_000, max: 500_000 },
  { key: "500k+", label: "৳500k+", min: 500_000 },
];
