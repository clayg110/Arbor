import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Crawlers may index the public marketing + legal surface; the authenticated app
// (and API) is disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/legal"],
        disallow: [
          "/radar",
          "/feed",
          "/analytics",
          "/watchlist",
          "/review",
          "/company",
          "/admin",
          "/settings",
          "/api",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
