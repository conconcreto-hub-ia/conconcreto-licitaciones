import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Archivos que el servidor lee del disco en tiempo de ejecución: sin esto no viajan a Vercel.
  outputFileTracingIncludes: { "/**": ["./plantillas/**/*"] },
  /* config options here */
};

export default nextConfig;
