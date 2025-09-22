/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh for better HMR
      fastRefresh: true,
      // Optimize JSX runtime
      jsxRuntime: 'automatic',
      // Better development experience
      include: '**/*.{jsx,tsx}',
      babel: {
        plugins: [
          // Add any Babel plugins for better HMR if needed
        ]
      }
    })
  ],

  // Path resolution for better imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/test': path.resolve(__dirname, './src/test')
    }
  },

  // Optimized dependency pre-bundling
  optimizeDeps: {
    // Exclude these from pre-bundling for better HMR
    exclude: ['lucide-react'],
    // Include commonly used dependencies
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-hook-form',
      '@hookform/resolvers/zod',
      'zod',
      'react-hot-toast'
    ],
    // Force dependency optimization
    force: false,
    // Optimize ESM dependencies
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          ui: ['react-hot-toast', 'lucide-react'],
          excel: ['xlsx'],
          database: ['@supabase/supabase-js', 'dexie'],
          workers: ['comlink']
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  // Enhanced development server configuration
  server: {
    port: 5175,
    strictPort: true,
    host: true,
    // Improved HMR settings
    hmr: {
      port: 5176,
      overlay: true,
      clientPort: 5176
    },
    // Faster file watching
    watch: {
      usePolling: false,
      // Ignore unnecessary files for better performance
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/.git/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/*.md',
        '**/*.log'
      ]
    },
    // CORS settings for development
    cors: true,
    // Open browser automatically
    open: false,
    // Faster startup
    fs: {
      strict: false,
      allow: ['..']
    }
  },

  // Production preview server
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
    cors: true
  },

  // Environment variables configuration
  envPrefix: ['VITE_', 'NODE_ENV'],

  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      // Add any CSS preprocessor options here
    }
  },

  // Worker configuration
  worker: {
    format: 'es',
    plugins: () => [react()]
  },

  // ESBuild configuration for better performance
  esbuild: {
    target: 'esnext',
    logOverride: {
      'this-is-undefined-in-esm': 'silent'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.*',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'dist/',
        '.git/',
        'coverage/'
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85
      }
    },
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
