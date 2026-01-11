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
    // Keep console logs in production for debugging, only remove debugger statements
    drop: mode === 'production' ? ['debugger'] : [],
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
        // Improved chunk splitting for better caching
        manualChunks: (id) => {
          // Core vendor chunks
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-core';
          }
          // UI library chunks
          if (id.includes('@radix-ui') || id.includes('@headlessui')) {
            return 'ui-libs';
          }
          // Skip recharts chunking - let it bundle with main code to avoid initialization issues
          // if (id.includes('recharts')) {
          //   return 'charts';
          // }
          if (id.includes('@supabase')) {
            return 'supabase';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'react-query';
          }
          // Animation libraries
          if (id.includes('framer-motion') || id.includes('@react-spring')) {
            return 'animations';
          }
          // Utilities
          if (id.includes('lodash') || id.includes('date-fns')) {
            return 'utils';
          }
        },
        // Optimize chunk names
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
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'recharts', // Pre-bundle recharts to prevent initialization issues
      'sql.js', // Include SQL.js for Clear Logo functionality
    ],
    exclude: [
      '@huggingface/transformers', // Exclude heavy ML library from pre-bundling
      'regenerator-runtime/runtime.js' // Exclude regenerator-runtime to prevent build issues
    ],
  },

  // Handle SQL.js WASM files
  assetsInclude: ['**/*.wasm'],
}));
