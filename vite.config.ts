import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' keeps asset paths relative so the build works on GitHub Pages or any static host
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
