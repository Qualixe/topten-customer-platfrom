import Link from "next/link";
import Image from "next/image";
import { Store } from "lucide-react";

export function Brand({ logoUrl = null }: { logoUrl?: string | null }) {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-1 text-base font-semibold tracking-tight"
    >
      {logoUrl ? (
        <span className="flex h-12 w-auto shrink-0 items-center justify-center">
          <Image
            src={logoUrl}
            alt="TopTen"
            width={192}
            height={48}
            priority
            className="h-12 w-auto object-contain"
          />
        </span>
      ) : (
        <>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate">TopTen</span>
        </>
      )}
    </Link>
  );
}
