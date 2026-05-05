import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * Multi-page setup: `app/index.html` is the React shell at `/app/`, but Vite's
 * HTML fallback serves the *root* `index.html` for unknown paths like `/app/onboarding`.
 * Rewrite those navigations to `/app/index.html` so React Router (basename `/app`) works.
 */
function cometAppSpaFallback(): Plugin {
  const shouldRewriteAppPath = (pathname: string) => {
    if (!(pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/'))) return false
    const last = pathname.split('/').pop() ?? ''
    if (last.includes('.')) return false
    return true
  }

  const rewriteMiddleware = (
    req: { url?: string },
    _res: unknown,
    next: (err?: unknown) => void,
  ) => {
    const raw = req.url ?? ''
    const pathname = raw.split('?')[0] ?? ''
    if (shouldRewriteAppPath(pathname)) {
      const q = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
      req.url = '/app/index.html' + q
    }
    next()
  }

  return {
    name: 'comet-app-spa-fallback',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(rewriteMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteMiddleware)
    },
  }
}

export default defineConfig({
  plugins: [cometAppSpaFallback(), react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        app: path.resolve(__dirname, 'app/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
