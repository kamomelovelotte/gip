import type { NextConfig } from "next";
const config: NextConfig = { devIndicators: false, trailingSlash: true, images: { unoptimized: true }, allowedDevOrigins: ["terminal.local"] };
export default config;
