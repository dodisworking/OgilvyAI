/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig

// Start server on 127.0.0.1 instead of 0.0.0.0 to avoid permission issues
if (typeof require !== 'undefined') {
  const { createServer } = require('http')
}