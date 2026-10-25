import type { NextConfig } from "next";

// Static CSP permits Next's inline bootstrap and Leaflet's inline positioning.
// Nonce-based script enforcement needs per-request rendering; do not pretend this
// baseline prevents all script injection. Payment currently uses a hosted redirect.
export function securityHeaders(production: boolean) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://app.midtrans.com https://app.sandbox.midtrans.com",
    `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"} https://app.midtrans.com https://app.sandbox.midtrans.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    "font-src 'self'",
    `connect-src 'self'${production ? "" : " ws: wss:"} https://api.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com https://app.sandbox.midtrans.com`,
    "frame-src https://app.midtrans.com https://app.sandbox.midtrans.com",
    "worker-src 'self'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Order URLs contain bearer tokens; never send them to gateway/map origins.
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lint is an explicit CI step using oxlint; current eslint-config-next dependency
  // has a high-severity transitive audit finding.
  eslint: { ignoreDuringBuilds: true },
  async headers() { return [{ source: "/(.*)", headers: securityHeaders(process.env.NODE_ENV === "production") }]; },
};
export default nextConfig;
