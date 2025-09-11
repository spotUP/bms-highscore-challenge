export default {
  // Build configuration for lovable.dev
  build: {
    // Skip environment validation during build
    prebuild: false,
    // Use standard Vite build
    command: "vite build",
    // Output directory
    outDir: "dist"
  },
  // Environment variables that can be missing during build
  env: {
    optional: [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    ]
  }
};
