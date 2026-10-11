import Link from "next/link";

import { SITE } from "@/content/site";

export default function NotFound() {
  return (
    <main className="moved">
      <h1>This page isn&apos;t here</h1>
      <p>
        Go to the <Link href="/">Ayudhas home page</Link>, or open <a href={SITE.financeUrl}>Ayudhas Finance</a>.
      </p>
    </main>
  );
}
