import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every canonical URL in spec 4.1/4.3 ends in a slash. Without this, Next
  // 308-redirects the slashed form to the unslashed one and turns each 301
  // below into a two-hop chain ending on a non-canonical URL.
  trailingSlash: true,

  // Spec §33 baseline response headers. A CSP is deliberately not set here: it
  // needs a nonce strategy tested against every page, which is its own task.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },

  async redirects() {
    // Spec 4.3: both retired directory URLs return a permanent 301 to the
    // combined directory. statusCode: 301 is deliberate — `permanent: true`
    // would emit 308. /professionals/profile/?id= is NOT listed here: it needs
    // a database lookup and is handled by src/app/professionals/profile/route.ts.
    return [
      {
        source: "/services/",
        destination: "/services/professionals/",
        statusCode: 301,
      },
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
