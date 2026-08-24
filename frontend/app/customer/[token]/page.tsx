import { notFound } from "next/navigation";

import { SiteLogoHeader } from "@/components/branding/site-logo-header";
import { CustomerProfileForm } from "@/components/customer-profile/customer-profile-form";
import { CustomerProfileHero } from "@/components/customer-profile/customer-profile-hero";
import { getPublicCustomerProfile } from "@/lib/api/public-customer-profile";
import { ApiError } from "@/lib/api/types";

// The token identifies an existing customer, not a resource that can be
// prerendered ahead of time — always render fresh per request.
export const dynamic = "force-dynamic";

export default async function CustomerProfilePage(
  props: PageProps<"/customer/[token]">
) {
  const { token } = await props.params;

  let profile;
  try {
    profile = await getPublicCustomerProfile(token);
  } catch (error) {
    // Missing, expired, and revoked tokens all come back as 404 from the
    // backend with the same generic message — treated identically here so
    // this page never reveals *why* a link doesn't work.
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-6">
      <header className="py-6">
        <SiteLogoHeader />
      </header>
      <CustomerProfileHero />
      <CustomerProfileForm
        token={token}
        name={profile.name}
        dateOfBirth={profile.dateOfBirth}
        address={profile.address}
        email={profile.email}
      />
    </div>
  );
}
