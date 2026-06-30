import type { NextConfig } from "next";

// Security headers applied to every route. These five are functionally inert
// (they constrain framing, MIME sniffing, referrer leakage and powerful
// browser features) so they are safe to enable without an observation wave.
//
// NOTE: a Content-Security-Policy is intentionally NOT set here yet — pms loads
// Google Maps, Lottie, react-pdf and other third-party origins, so an enforcing
// CSP needs a Report-Only measurement wave first (see SECURITY-AUDIT.md). HSTS
// is scoped to this host only (no includeSubDomains/preload) so it cannot force
// HTTPS onto sibling subdomains like db.bios.co.il.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['pms.bios.co.il'],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
