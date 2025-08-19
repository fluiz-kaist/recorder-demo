import type { NextConfig } from "next";
const isProd = process.env.NODE_ENV === "production";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: isProd, // prod일 때만 console.* 제거
  },
  api: {
    responseLimit: "8mb", // 1MB → 8MB로 증가
    bodyParser: {
      sizeLimit: "10mb", // 요청 크기도 함께 증가
    },
  },
};

export default nextConfig;
