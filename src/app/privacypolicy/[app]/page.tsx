import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrivacyPolicy } from "@/components/privacy-policy";
import { POLICIES } from "@/content/site";

import "../legal.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return POLICIES.map((p) => ({ app: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ app: string }> }): Promise<Metadata> {
  const { app } = await params;
  const policy = POLICIES.find((p) => p.slug === app);
  if (!policy) return {};
  return {
    title: `${policy.app} privacy policy`,
    description: `How the ${policy.app} Android app handles your data: everything stays on your phone.`,
    alternates: { canonical: `/privacypolicy/${policy.slug}/` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params;
  const policy = POLICIES.find((p) => p.slug === app);
  if (!policy) notFound();
  return <PrivacyPolicy policy={policy} />;
}
