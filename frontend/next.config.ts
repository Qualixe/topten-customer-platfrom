import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Cloudflare quick tunnel (a different origin than localhost)
  // reach the dev server's assets/endpoints — Next.js blocks cross-origin
  // dev requests by default. Wildcard covers trycloudflare.com's randomly
  // generated subdomain, which changes on every tunnel restart.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
