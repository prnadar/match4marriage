/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for catching issues early
  reactStrictMode: true,

  // Image optimization — allow S3 + CloudFront domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // PWA headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },

  // Redirect bare / to landing for authenticated users
  async redirects() {
    return [];
  },
};

export default nextConfig;
