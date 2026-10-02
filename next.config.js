/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  reactStrictMode: false,
  optimizeFonts: false,
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
