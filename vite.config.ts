import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv, type ProxyOptions } from 'vite';
import { defineConfig } from 'vitest/config';

// Dev-proxy observability mirroring the Netlify edge helper: surface proxy
// errors and upstream 4xx/5xx as structured log lines so the proxy is debuggable
// in dev too. Secrets (injected auth headers) are never logged.
function logDevProxy(name: string): ProxyOptions['configure'] {
  return (proxy) => {
    proxy.on('error', (err, req) => {
      console.error(JSON.stringify({ level: 'error', proxy: name, path: req.url, error: err.message }));
    });
    proxy.on('proxyRes', (proxyRes, req) => {
      const status = proxyRes.statusCode ?? 0;
      if (status >= 400) {
        const level = status >= 500 ? 'error' : 'warn';
        console.warn(JSON.stringify({ level, proxy: name, path: req.url, status }));
      }
    });
  };
}

export default defineConfig(({ mode }) => {
  // Load .env without the VITE_ prefix filter: BITREFILL_API_KEY must stay
  // server-side only — it is injected by the dev proxy and never reaches the bundle.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@app': path.resolve(__dirname, './src/app'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@widgets': path.resolve(__dirname, './src/widgets'),
        '@features': path.resolve(__dirname, './src/features'),
        '@entities': path.resolve(__dirname, './src/entities'),
        '@shared': path.resolve(__dirname, './src/shared'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api/bitrefill': {
          target: 'https://api.bitrefill.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/bitrefill/, ''),
          headers: {
            Authorization: `Bearer ${env.BITREFILL_API_KEY ?? ''}`,
          },
          configure: logDevProxy('bitrefill'),
        },
        // Same-origin proxy mirrors the Netlify edge function: the trade-api
        // gateway only serves CORS for localhost, so production must proxy —
        // dev does too for parity (and the key stays out of the bundle).
        '/api/uniswap': {
          target: 'https://trade-api.gateway.uniswap.org',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/uniswap/, ''),
          headers: {
            'x-api-key': env.UNISWAP_API_KEY ?? env.VITE_UNISWAP_API_KEY ?? '',
          },
          configure: logDevProxy('uniswap'),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      css: false,
      // Hermetic: tests must pass on a fresh clone / CI runner with no .env —
      // env.ts validates this variable at import time.
      env: {
        VITE_WALLETCONNECT_PROJECT_ID: 'test-walletconnect-project-id',
      },
    },
  };
});
