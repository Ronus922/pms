import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['pms.bios.co.il'],
};

export default nextConfig;
