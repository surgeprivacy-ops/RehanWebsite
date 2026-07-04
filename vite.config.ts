import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Ensure a single React instance so @react-three/fiber's renderer shares hooks
  // with the app tree (avoids "Invalid hook call" from duplicate pre-bundled React).
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', '@react-three/fiber', '@react-three/drei', 'three'],
  },
})
