import type { Metadata } from "next";

import { LEGACY_FINANCE_PATHS, SITE } from "@/content/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGACY_FINANCE_PATHS.map((p) => ({ legacy: p.split("/") }));
}

export const metadata: Metadata = {
  title: "Moved to Ayudhas Finance",
  robots: { index: false, follow: true },
};

/**
 * Old finance-app addresses on ayudhas.com (bookmarks, shared links) forward to the same page on
 * finance.ayudhas.com. An inline script runs first and keeps ?query and #hash (e.g. /loans/view/?id=3);
 * the meta refresh is the fallback when JavaScript is off.
 */
export default async function LegacyPage({ params }: { params: Promise<{ legacy: string[] }> }) {
  const { legacy } = await params;
  const path = `/${legacy.join("/")}/`;
  const target = `${SITE.financeUrl}${path}`;
  const script = `location.replace(${JSON.stringify(target)}+location.search+location.hash)`;
  return (
    <main className="moved">
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <meta httpEquiv="refresh" content={`2; url=${target}`} />
      <h1>Ayudhas Finance has moved</h1>
      <p>This page now lives at <a href={target}>{target.replace("https://", "")}</a>.</p>
    </main>
  );
}
