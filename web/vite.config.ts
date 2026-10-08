import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The client calls /api on its own origin, so the session cookie reaches the chat and data endpoints.
const proxy = { '/api': 'http://localhost:8000' }

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { proxy },
  preview: { proxy },
  css: {
    // Carbon's Sass triggers deprecation warnings that are not ours to fix.
    preprocessorOptions: { scss: { quietDeps: true } },
  },
})
