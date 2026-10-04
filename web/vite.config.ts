import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    // Carbon's Sass triggers deprecation warnings that are not ours to fix.
    preprocessorOptions: { scss: { quietDeps: true } },
  },
})
