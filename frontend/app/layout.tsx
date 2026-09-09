import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { getResolvedBrandColorSafe, getResolvedFaviconUrlSafe } from "@/lib/api/site-settings";
import { buildBrandColorStyle } from "@/lib/theme/brand-color";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  // The default lives at public/favicon.ico (a plain static asset), not
  // app/favicon.ico — Next's app/ file-convention auto-injects its own
  // <link rel="icon"> in addition to whatever `icons` below resolves to,
  // rather than replacing it, which would render two competing favicon
  // links (browsers may keep showing the old one after an admin uploads a
  // new favicon). Setting `icons` here is the only favicon link emitted.
  const faviconUrl = await getResolvedFaviconUrlSafe();
  return {
    title: "TopTen Customer Platform",
    description: "Customer management and loyalty platform for TopTen Supermarket",
    icons: { icon: faviconUrl ?? "/favicon.ico" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const brandColor = await getResolvedBrandColorSafe();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      // The theme-init script below adds the "dark" class before hydration
      // based on localStorage/OS preference, which the server can't know —
      // an intentional, expected className mismatch on this one element,
      // not a real bug. Suppressing it here (not app-wide) is the standard
      // fix for this exact no-flash-of-wrong-theme pattern.
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint — without this, the
         * page would flash light and then swap to dark once React
         * hydrates. Reads a plain localStorage flag (no next-themes here,
         * this is the only place the app needs it) and falls back to the
         * OS preference if the user hasn't chosen one yet.
         *
         * A raw <script> tag here is never executed on the client (React
         * treats it as inert markup, logging "Encountered a script tag
         * while rendering..." instead) — next/script's beforeInteractive
         * strategy is what actually gets this injected into the initial
         * HTML and run before hydration; see node_modules/next/dist/docs/
         * 01-app/03-api-reference/02-components/script.md. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');" +
              "var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);" +
              "if(d)document.documentElement.classList.add('dark');}catch(e){}})();",
          }}
        />
        {/* Admin-editable brand color (Settings → General) — overrides the
         * default --primary/--ring tokens from globals.css so every button,
         * focus ring, and the sidebar's active nav state pick it up, on
         * every page, logged in or not. */}
        <style>{buildBrandColorStyle(brandColor)}</style>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
