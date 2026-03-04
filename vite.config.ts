import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Polyfill process.env for browser compatibility
    'process.env': {}
  },
  server: {
    host: "::",
    port: 8081,
    strictPort: true, // Always use port 8081, fail if occupied instead of trying another port
    proxy: {
      // Proxy API requests to the logo proxy server in development
      '/api/clear-logos': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    react({
      // Disable ESLint during build to prevent CI failures
      plugins: mode === 'production' ? [] : undefined,
    }),
  ],
  esbuild: {
    // Drop console.log and debugger statements in production
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimized build configuration for Raspberry Pi 5
  build: {
    chunkSizeWarningLimit: 1000,
    // Enable minification in production (console logs already stripped by esbuild)
    minify: mode === 'production' ? 'esbuild' : false,
    // Optimize for modern browsers (Pi 5 runs modern Chromium)
    target: 'es2020',
    // Better source maps for production
    sourcemap: mode === 'development',
    // Optimize CSS
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      onwarn: (warning, warn) => {
        // Suppress ESLint warnings during build
        if (warning.code === 'PLUGIN_WARNING' && warning.plugin === 'vite:eslint') {
          return;
        }
        warn(warning);
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Report compressed size
    reportCompressedSize: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      'recharts',
    ],
  },

  assetsInclude: ['**/*.wasm'],
}));
