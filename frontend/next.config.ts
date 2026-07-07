import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@service-dependency/shared"]
};

export default nextConfig;
