import { notFound } from "next/navigation";

import { SiteLogoHeader } from "@/components/branding/site-logo-header";
import { PublicCampaignForm } from "@/components/campaign-landing/public-campaign-form";
import { getPublicCampaignLandingPage } from "@/lib/api/public-campaign";
import { getPublicCustomerProfile } from "@/lib/api/public-customer-profile";
import { ApiError } from "@/lib/api/types";

// A published landing page can change at any time from the builder —
// never prerendered/cached.
export const dynamic = "force-dynamic";

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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-6">
      <header className="py-6">
        <SiteLogoHeader />
      </header>
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
  );
}
