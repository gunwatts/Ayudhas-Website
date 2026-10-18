import type { MetadataRoute } from "next";

import { SITE } from "@/content/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/solar-vision/`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
