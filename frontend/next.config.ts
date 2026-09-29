import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      { pathname: "/wordx-icon-256.png", search: "?v=20260915" },
      { pathname: "/wordx-icon.png", search: "?v=20260915" },
    ],
  },
  allowedDevOrigins: [
    "26.35.255.123",
    "10.58.198.17",
    "localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL || "http://backend:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
