import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Vercel builder expects `.next` at repo root when Root Directory is unset.
  distDir: process.env.VERCEL ? "../../.next" : ".next",
  // Nén gzip output cho server tự host (Vercel có CDN nén riêng nhưng để bật cho an toàn).
  compress: true,
  // Không phát source map ra production để giảm dung lượng tải.
  productionBrowserSourceMaps: false,
  images: {
    // Ưu tiên định dạng nhẹ cho ảnh tối ưu qua next/image.
    formats: ["image/webp"],
    // Cache ảnh đã tối ưu 7 ngày.
    minimumCacheTTL: 604800,
  },
};

export default withBundleAnalyzer(nextConfig);
