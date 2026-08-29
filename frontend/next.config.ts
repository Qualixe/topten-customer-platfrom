import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Cloudflare tunnel (a different origin than localhost) reach
  // the dev server's assets/HMR websocket — Next.js blocks cross-origin
  // dev requests by default. *.trycloudflare.com covers the free quick
  // tunnel's randomly generated subdomain (changes on every restart);
  // *.qualixe.com covers the named "topten" tunnel's stable custom domain.
  allowedDevOrigins: ["*.trycloudflare.com", "*.qualixe.com"],
};

export default nextConfig;
