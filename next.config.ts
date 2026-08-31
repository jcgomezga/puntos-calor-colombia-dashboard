import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: process.env.GITHUB_ACTIONS === "true" ? "/puntos-calor-colombia-dashboard" : "",
  assetPrefix: process.env.GITHUB_ACTIONS === "true" ? "/puntos-calor-colombia-dashboard/" : "",
};

export default nextConfig;
