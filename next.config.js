/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors/warnings.
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

// Start server on 127.0.0.1 instead of 0.0.0.0 to avoid permission issues
if (typeof require !== 'undefined') {
  const { createServer } = require('http')
}