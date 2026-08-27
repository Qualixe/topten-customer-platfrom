import { Store } from "lucide-react";

export default function CampaignLandingPageUnavailable() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Store className="size-4" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">
          Sorry, this link is no longer available.
        </h1>
        <p className="text-sm text-muted-foreground">
          Please contact TopTen Supermarket if you need a new link.
        </p>
      </div>
    </div>
  );
}
