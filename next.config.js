const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  return {
    reactStrictMode: true,
    // Keep local build gates from clobbering the active dev server (.next).
    // If NEXT_DIST_DIR is specified, honor it. On Vercel or CI, build into .next.
    // In local dev, build gate compiles into .next-build so localhost:3000 stays healthy.
    distDir:
      process.env.NEXT_DIST_DIR ||
      (phase === PHASE_DEVELOPMENT_SERVER
        ? '.next'
        : (process.env.VERCEL || process.env.CI ? '.next' : '.next-build')),
  }
}
