import type { NextConfig } from "next";

// Where the Express API lives. On Vercel this is the API project's URL.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Same-origin proxy: the browser calls /api/* on THIS site and Vercel
  // forwards it to the API. That keeps the httpOnly auth cookie first-party
  // (a cookie set by a different *.vercel.app domain is a third-party cookie
  // and is blocked by Safari and by Chrome's stricter modes), and removes
  // the need for CORS. In production set NEXT_PRIVATE_API_URL=/api.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
