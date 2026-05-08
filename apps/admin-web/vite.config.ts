import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readPublicVersion } from '../api/src/common/version/public-version';

function normalizeTarget(input: string): string {
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = normalizeTarget(env.ADMIN_WEB_API_TARGET || 'http://localhost:3001');
  const internalApiKey = env.ADMIN_INTERNAL_API_KEY || '';
  const publicVersion = readPublicVersion(import.meta.url);

  return {
    define: {
      __SYSTEM_PUBLIC_VERSION__: JSON.stringify(publicVersion)
    },
    plugins: [react()],
    server: {
      port: Number(env.ADMIN_WEB_PORT || 4173),
      proxy: {
        '/admin-api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/admin-api/, '/api/v2/internal/admin'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (internalApiKey) {
                proxyReq.setHeader('X-Internal-Api-Key', internalApiKey);
              }

              const adminAuthHeader = req.headers['x-admin-authorization'];
              if (typeof adminAuthHeader === 'string' && adminAuthHeader.length > 0) {
                proxyReq.setHeader('Authorization', adminAuthHeader);
              }
              proxyReq.removeHeader('X-Admin-Authorization');
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
