import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: { '/api/physics': { target: 'http://127.0.0.1:3003', changeOrigin: false } }
  },
  preview: { proxy: { '/api/physics': { target: 'http://127.0.0.1:3003', changeOrigin: false } } },
  build: {
    sourcemap: false,
    modulePreload: {
      resolveDependencies(_url, deps, context) {
        if (context.hostType !== 'html') {
          return deps
        }

        return deps.filter((dependency) =>
          dependency.includes('react-vendor') ||
          dependency.includes('state-vendor') ||
          dependency.includes('index-')
        )
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'react-vendor'
            }
            if (
              id.includes('@react-three/fiber') ||
              id.includes('@react-three/drei') ||
              id.includes('@react-three/rapier') ||
              id.includes('/three/')
            ) {
              return 'three-vendor'
            }
            if (id.includes('/zustand/')) {
              return 'state-vendor'
            }
          }

          if (id.includes('/src/components/Race') || id.includes('/src/data/racePresets')) {
            return 'race-mode'
          }

          if (
            id.includes('/src/components/FreeFlightScene') ||
            id.includes('/src/components/MapTerrain') ||
            id.includes('/src/components/Quadcopter') ||
            id.includes('/src/components/SceneScenery') ||
            id.includes('/src/data/mapPresets')
          ) {
            return 'free-flight'
          }
        }
      }
    }
  }
})
