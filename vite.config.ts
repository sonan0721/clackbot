import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  root: 'src/web/frontend',
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/web/frontend') },
  },
  build: {
    outDir: '../../../dist/src/web/public',
    emptyOutDir: true,
  },
  server: {
    proxy: { '/api': 'http://localhost:3847' },
  },
})
