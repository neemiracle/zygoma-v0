/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Add support for VTK.js GLSL shaders
    config.module.rules.push({
      test: /\.glsl$/,
      use: 'raw-loader',
    });
    return config;
  },
}

export default nextConfig
