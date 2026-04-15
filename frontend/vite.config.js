import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Koreňový /fact/.env (VITE_API_URL) — štandardne Vite číta len frontend/.env
  envDir: '..',
})
