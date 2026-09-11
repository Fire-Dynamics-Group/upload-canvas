/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep browser-test builds separate from the interactive dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
}

module.exports = nextConfig
