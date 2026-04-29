/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/dev/test-shopify-upload': ['./lib/shopify/test-asset.jpg'],
    },
  },
};

export default nextConfig;
