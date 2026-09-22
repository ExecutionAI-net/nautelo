import type { NextConfig } from "next";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8020";

// `next dev` needs eval for React refresh; production never gets it.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEV_EVAL = IS_PRODUCTION ? "" : " 'unsafe-eval'";
// Local MinIO serves images over plain http; production media is https (S3).
const DEV_IMG = IS_PRODUCTION ? "" : " http://localhost:* http://127.0.0.1:*";

// Cloudflare injects its Web Analytics beacon on the zone, outside this repo's control;
// without these two origins it 404s on script-src/connect-src and logs a CSP violation
// on every page load (a Lighthouse Best Practices finding, not a real bug).
const CLOUDFLARE_INSIGHTS = "https://static.cloudflareinsights.com";

export const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CLOUDFLARE_INSIGHTS}${DEV_EVAL}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: https:${DEV_IMG}`,
  `connect-src 'self' ${API_ORIGIN} ${API_ORIGIN.replace(/^http/, "ws")} https:`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
].join("; ");

const nextConfig: NextConfig = {
  // Every canonical URL in spec 4.1/4.3 ends in a slash. Without this, Next
  // 308-redirects the slashed form to the unslashed one and turns each 301
  // below into a two-hop chain ending on a non-canonical URL.
  trailingSlash: true,

  // Spec §33 baseline response headers. The CSP ships as Report-Only: Next
  // inlines scripts and the pages load Google Fonts, so an enforcing policy
  // needs a nonce strategy tested against every page first. Enforce after the
  // violation reports are clean.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      // The design mockup images in public/design/ are content-hashed filenames that
      // never change under a given name (spec: keep as demo assets until launch), so
      // they can cache for a year like a build asset. Unlike /_next/static, Next does
      // not set this for files served straight out of public/ on its own.
      {
        source: "/design/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  async redirects() {
    // Spec 4.3: both retired directory URLs return a permanent 301 to the
    // combined directory. statusCode: 301 is deliberate — `permanent: true`
    // would emit 308. /professionals/profile/?id= is NOT listed here: it needs
    // a database lookup and is handled by src/app/professionals/profile/route.ts.
    return [
      // /services/ has no page of its own: /services/professionals/ is the single
      // services entry point (spec 4.3).
      {
        source: "/services/",
        destination: "/services/professionals/",
        statusCode: 301,
      },
      // Spec 4.2 canonical private routes; the earlier flat paths redirect once.
      { source: "/dashboard/listings/", destination: "/dashboard/private-seller/listings/", statusCode: 301 },
      { source: "/dashboard/messages/:path*", destination: "/dashboard/private-seller/messages/:path*", statusCode: 301 },
      { source: "/account/", destination: "/dashboard/private-seller/account/", statusCode: 301 },
      { source: "/fleet/", destination: "/dashboard/broker/fleet/", statusCode: 301 },
      { source: "/settings/", destination: "/dashboard/staff/settings/", statusCode: 301 },
      { source: "/compare/", destination: "/boats/compare/", statusCode: 301 },
      // The six service detail pages live under the directory page.
      ...["full-brokerage", "legal", "insurance", "engines-maintenance", "transport-delivery", "nautical-marketing"].map(
        (slug) => ({
          source: `/services/${slug}/`,
          destination: `/services/professionals/${slug}/`,
          statusCode: 301 as const,
        }),
      ),
      {
        source: "/professionals/",
        destination: "/services/professionals/",
        statusCode: 301,
      },
      {
        // Spec 4.2/4.3: slashed form is canonical (trailingSlash above), so this
        // stays a single hop.
        source: "/dashboard/broker/services/",
        destination: "/dashboard/broker/messages/",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
