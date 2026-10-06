/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    // OAuth 2.1 / MCP discovery documents for the agent access layer
    // (RFC 8414 + RFC 9728). Clients probe the bare and the path-suffixed forms.
    return [
      { source: "/.well-known/oauth-authorization-server", destination: "/api/v1/agent/oauth/well-known/oauth-authorization-server" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/v1/agent/oauth/well-known/oauth-authorization-server" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/v1/agent/oauth/well-known/oauth-protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/v1/agent/oauth/well-known/oauth-protected-resource" },
    ];
  },
};

export default nextConfig;
