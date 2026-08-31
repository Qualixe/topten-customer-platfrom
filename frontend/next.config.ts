import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the minimal Docker production image (copies only what's needed)
  output: "standalone",
  // One less response header, no functional purpose otherwise.
  poweredByHeader: false,
  // Lets the Cloudflare tunnel (a different origin than localhost) reach
  // the dev server's assets/HMR websocket — Next.js blocks cross-origin
  // dev requests by default. *.trycloudflare.com covers the free quick
  // tunnel's randomly generated subdomain (changes on every restart);
  // *.qualixe.com covers the named "topten" tunnel's stable custom domain.
  allowedDevOrigins: ["*.trycloudflare.com", "*.qualixe.com"],
  images: {
    // Backend-served uploads (site logo, gift images) — only PNG/JPEG/WEBP
    // are ever accepted on upload (see ALLOWED_IMAGE_CONTENT_TYPES /
    // ALLOWED_CONTENT_TYPES on the backend), so it's always safe to let
    // Next optimize (resize/re-encode) these rather than serving them raw.
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "https", hostname: "*.qualixe.com" },
      // Railway backend service public domain
      { protocol: "https", hostname: "*.up.railway.app" },
    ],
  },
  // Baseline hardening headers — none of these restrict scripts/styles, so
  // they can't break existing pages. A Content-Security-Policy is left out
  // deliberately: it needs careful testing against Next's hydration/inline
  // styles and Recharts before it can be turned on safely.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
