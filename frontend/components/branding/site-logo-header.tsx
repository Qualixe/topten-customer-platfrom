import { LogoMark } from "@/components/branding/logo-mark";
import { getResolvedLogoUrlSafe } from "@/lib/api/site-settings";

/**
 * Centered brand mark for standalone pages outside the dashboard shell
 * (public customer profile, login, public campaign). Shows only the
 * uploaded logo image when one is set — no separate "TopTen" text, since a
 * real logo asset already carries its own branding. Falls back to the
 * default mark + text when no logo has been uploaded.
 */
export async function SiteLogoHeader() {
  const logoUrl = await getResolvedLogoUrlSafe();
  return <LogoMark logoUrl={logoUrl} />;
}
