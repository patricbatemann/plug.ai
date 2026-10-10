import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The client calls /api on its own origin.
const proxy = { '/api': 'http://localhost:8000' }

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { proxy },
  preview: { proxy },
})
