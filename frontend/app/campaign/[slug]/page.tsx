import { notFound } from "next/navigation";
import { Clock3, ShieldCheck, Sparkles } from "lucide-react";

import { SiteLogoHeader } from "@/components/branding/site-logo-header";
import { PublicCampaignForm } from "@/components/campaign-landing/public-campaign-form";
import { getPublicCampaignLandingPage } from "@/lib/api/public-campaign";
import { getPublicCustomerProfile } from "@/lib/api/public-customer-profile";
import { ApiError } from "@/lib/api/types";

// A published landing page can change at any time from the builder —
// never prerendered/cached.
export const dynamic = "force-dynamic";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Secure & private" },
  { icon: Clock3, label: "Takes under a minute" },
  { icon: Sparkles, label: "Personalized for you" },
];

export default async function PublicCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  let landingPage;
  try {
    landingPage = await getPublicCampaignLandingPage(slug);
  } catch (err) {
    // A missing or unpublished page 404s identically — never reveals which.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // The link in a campaign SMS always includes ?token=... — without one
  // there's no customer to attach a submission to, so there's nothing safe
  // to show. The token (not this page) is what the backend trusts to know
  // which customer and campaign this is for; see
  // app.controllers.public_profile for that check.
  if (!token) notFound();

  let profile;
  try {
    profile = await getPublicCustomerProfile(token);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    throw err;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 to-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-8 sm:py-10">
        <header className="pb-8">
          <SiteLogoHeader />
        </header>

        {/* Trust strip — sets expectations before the form itself, which is
         * entirely the admin's builder content below. */}
        <ul className="mb-6 flex items-center justify-center gap-4 sm:gap-6">
          {TRUST_POINTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex flex-1 flex-col items-center gap-1.5 text-center text-xs text-muted-foreground"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <div className="flex-1">
          <PublicCampaignForm
            token={token}
            blocks={landingPage.builderData.blocks}
            initialValues={{
              dateOfBirth: profile.dateOfBirth ?? "",
              address: profile.address ?? "",
              email: profile.email ?? "",
            }}
          />
        </div>

        <footer className="flex items-center justify-center gap-1.5 pt-8 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Your information is kept private and secure by TopTen.
        </footer>
      </div>
    </div>
  );
}
