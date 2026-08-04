import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The illustrations are served straight from /public as plain <img> tags.
  // Next's image optimizer would try to re-encode 666 PNGs on demand, which is
  // slower and no smaller — they're already flat-colour art on a fixed ground.
  images: { unoptimized: true },
};

export default nextConfig;
