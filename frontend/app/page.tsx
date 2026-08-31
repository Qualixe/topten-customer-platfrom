import Link from "next/link";
import { ArrowRight, Cake, Gift, Megaphone, Users } from "lucide-react";

import { SiteLogoHeader } from "@/components/branding/site-logo-header";
import { Button } from "@/components/ui/button";

const HIGHLIGHTS = [
  { icon: Users, label: "Customer records" },
  { icon: Megaphone, label: "SMS campaigns" },
  { icon: Gift, label: "Gifts & rewards" },
  { icon: Cake, label: "Birthday tracking" },
];

// Pure server-rendered marketing shell — no client JS beyond the <Link>
// itself, and no data fetching, so this is as close to instant as a page
// gets.
export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <SiteLogoHeader />

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Customer Platform
          </h1>
          <p className="text-lg text-muted-foreground text-balance">
            One place to manage customers, campaigns, and loyalty for TopTen Supermarket.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <Icon className="size-4 text-primary" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        <Button size="lg" nativeButton={false} render={<Link href="/dashboard" />}>
          Go to Dashboard
          <ArrowRight />
        </Button>
      </main>

      <footer className="relative py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} TopTen Supermarket. All rights reserved.
      </footer>
    </div>
  );
}
