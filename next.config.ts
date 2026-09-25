import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // `next dev` runs on Turbopack (the Next 16 default). The Serwist wrapper below
  // adds a webpack config, and without an explicit turbopack config Next refuses
  // to start dev. Serwist is disabled in dev anyway, so nothing is lost.
  turbopack: {},
};

// Serwist injects the service worker via a webpack plugin, so the production
// build must run with webpack (`next build --webpack`); Turbopack skips it.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
