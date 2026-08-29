import Image from "next/image";
import { Store } from "lucide-react";

/**
 * Presentational brand mark — the same "real logo, or default mark + text"
 * rendering `SiteLogoHeader` uses, split out so a client component (like the
 * campaign builder's preview) can render it too by receiving an
 * already-resolved `logoUrl` as a prop instead of fetching it itself.
 */
export function LogoMark({ logoUrl }: { logoUrl: string | null }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {logoUrl ? (
        <span className="flex h-14 w-auto shrink-0 items-center justify-center">
          <Image
            src={logoUrl}
            alt="TopTen"
            width={224}
            height={56}
            unoptimized
            className="h-14 w-auto object-contain"
          />
        </span>
      ) : (
        <>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">TopTen</span>
        </>
      )}
    </div>
  );
}
