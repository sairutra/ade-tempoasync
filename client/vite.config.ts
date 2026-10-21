import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Timeline sync socket (see src/timeline/sync), served by the Express backend.
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
})
