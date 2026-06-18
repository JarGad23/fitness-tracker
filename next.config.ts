import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

// Serwist injects the service worker via a webpack plugin, so the production
// build must run with webpack (`next build --webpack`); Turbopack skips it.
// Disabled in dev so the Turbopack dev server is unaffected.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
