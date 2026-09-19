import type { MetadataRoute } from "next";

const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3020";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/login/", "/api/"] }],
    sitemap: `${PUBLIC_BASE_URL}/sitemap.xml`,
  };
}
