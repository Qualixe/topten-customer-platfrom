import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

import { getResolvedBrandColorSafe } from "@/lib/api/site-settings";
import { buildBrandColorStyle } from "@/lib/theme/brand-color";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TopTen Customer Platform",
  description: "Customer management and loyalty platform for TopTen Supermarket",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const brandColor = await getResolvedBrandColorSafe();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
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
