import type { Metadata } from "next";
import Link from "next/link";

import { POLICIES } from "@/content/site";

import "./legal.css";

export const metadata: Metadata = {
  title: "Privacy policies",
  description: "Privacy policies for the Ayudhas Android apps.",
  alternates: { canonical: "/privacypolicy/" },
};

export default function PoliciesPage() {
  return (
    <main className="legal">
      <p className="label"><Link href="/">Ayudhas</Link></p>
      <h1>Privacy policies</h1>
      <ul>
        {POLICIES.map((p) => (
          <li key={p.slug}>
            <Link href={`/privacypolicy/${p.slug}/`}>{p.app}</Link> (Android, formerly {p.formerly})
          </li>
        ))}
      </ul>
    </main>
  );
}
