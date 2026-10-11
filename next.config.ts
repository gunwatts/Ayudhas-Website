import type { NextConfig } from "next";

/** Static export for GitHub Pages at ayudhas.com (repo Ayudhas-Website). No server features are used. */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
