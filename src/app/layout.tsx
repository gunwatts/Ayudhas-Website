import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Tiro_Devanagari_Sanskrit, Unbounded } from "next/font/google";

import { SITE } from "@/content/site";

import "./globals.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body", display: "swap" });
// Small labels and one Sanskrit word: not preloaded, so the two main faces and the CSS arrive first on slow networks.
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono", display: "swap", preload: false });
const sanskrit = Tiro_Devanagari_Sanskrit({ subsets: ["devanagari", "latin"], weight: "400", variable: "--font-sanskrit", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `Ayudhas · ${SITE.tagline}`, template: "%s · Ayudhas" },
  description: SITE.description,
  alternates: { canonical: "/" },
  applicationName: "Ayudhas",
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: "Ayudhas",
    title: `Ayudhas · ${SITE.tagline}`,
    description: SITE.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ayudhas: tools for a life in motion" }],
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: `Ayudhas · ${SITE.tagline}`, description: SITE.description, images: ["/og.png"] },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#060818", colorScheme: "dark", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable} ${sanskrit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
