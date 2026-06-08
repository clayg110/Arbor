import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Public, indexable URLs only.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ["/", "/login", "/legal/terms", "/legal/privacy"];
  return paths.map((p) => ({
    url: `${SITE.url}${p}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: p === "/" ? 1 : 0.5,
  }));
}
