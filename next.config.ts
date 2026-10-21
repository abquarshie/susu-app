import type { NextConfig } from "next";

// Applied to every response: no framing (clickjacking), no MIME sniffing, no full URLs leaked to other sites.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/adapter-neon", "@neondatabase/serverless", "ws"],
  experimental: {
    // Server Actions carry small JSON bodies; refuse anything large outright.
    serverActions: { bodySizeLimit: "200kb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
