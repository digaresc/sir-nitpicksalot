import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/race", destination: "/", permanent: false }];
  },
};

export default nextConfig;
