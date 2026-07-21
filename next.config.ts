import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/binary modules should be required at runtime, not bundled —
  // Turbopack's route tracing chokes on their native bindings otherwise.
  serverExternalPackages: ["better-sqlite3", "sharp", "pdf-to-img"],
};

export default nextConfig;
