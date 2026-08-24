import Image from "next/image";
import { Store } from "lucide-react";

import { getResolvedLogoUrlSafe } from "@/lib/api/site-settings";

/**
 * Centered brand mark for standalone pages outside the dashboard shell
 * (public customer profile, login). Shows only the uploaded logo image when
 * one is set — no separate "TopTen" text, since a real logo asset already
 * carries its own branding. Falls back to the default mark + text when no
 * logo has been uploaded.
 */
export async function SiteLogoHeader() {
  const logoUrl = await getResolvedLogoUrlSafe();

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
