import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  css: {
    // Carbon's Sass triggers deprecation warnings that are not ours to fix.
    preprocessorOptions: { scss: { quietDeps: true } },
  },
})
