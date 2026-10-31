/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A stray package-lock.json in the home folder made Turbopack guess the wrong project root
  turbopack: { root: __dirname },
}

module.exports = nextConfig
