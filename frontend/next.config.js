/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/preview/:path*',
        destination: 'http://localhost:8000/preview/:path*',
      },
      {
        source: '/api/process/:path*',
        destination: 'http://localhost:8000/process/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
