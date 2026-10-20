import type { MetadataRoute } from "next";

import { POLICIES, SITE } from "@/content/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/solar-vision/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/privacypolicy/`, changeFrequency: "yearly", priority: 0.3 },
    ...POLICIES.map((p) => ({ url: `${SITE.url}/privacypolicy/${p.slug}/`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
