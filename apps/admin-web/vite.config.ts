import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeTarget(input: string): string {
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = normalizeTarget(env.ADMIN_WEB_API_TARGET || 'http://localhost:3001');
  const internalApiKey = env.ADMIN_INTERNAL_API_KEY || '';

  return {
    plugins: [react()],
    server: {
      port: Number(env.ADMIN_WEB_PORT || 4173),
      proxy: {
        '/admin-api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/admin-api/, '/api/v2/internal/admin'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (internalApiKey) {
                proxyReq.setHeader('X-Internal-Api-Key', internalApiKey);
              }
            });
          }
        }
      }
    },
    preview: {
      port: Number(env.ADMIN_WEB_PREVIEW_PORT || 4273)
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'mui-vendor': [
              '@emotion/react',
              '@emotion/styled',
              '@mui/icons-material',
              '@mui/material'
            ]
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      exclude: ['e2e/**', 'node_modules/**'],
      coverage: {
        reporter: ['text', 'html']
      }
    }
  };
});
