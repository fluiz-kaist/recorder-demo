import type { NextConfig } from "next";
const isProd = process.env.NODE_ENV === "production";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: isProd, // prod일 때만 console.* 제거
  },
};

export default nextConfig;
