import { notFound } from "next/navigation";

import { SiteLogoHeader } from "@/components/branding/site-logo-header";
import { PublicGenericForm } from "@/components/form-landing/public-generic-form";
import { getPublicForm } from "@/lib/api/forms";
import { ApiError } from "@/lib/api/types";

// A published form can change at any time from the builder — never
// prerendered/cached.
export const dynamic = "force-dynamic";

// Root-level slug (e.g. mysite.com/store-signup, not mysite.com/form/{slug})
// — Next.js resolves the sibling literal routes (/login, /dashboard,
// /campaign/[slug], /customer/[token], etc.) first, so this only ever
// catches a single path segment that doesn't match one of those.
export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let form;
  try {
    form = await getPublicForm(slug);
  } catch (err) {
    // A missing or unpublished form 404s identically — never reveals which.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header>
        <SiteLogoHeader />
      </header>

      <PublicGenericForm slug={slug} fields={form.builderData.fields} />
    </div>
  );
}
